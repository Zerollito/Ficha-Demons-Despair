import { useState, useEffect, useCallback } from 'react';
import { AppState } from '../types';

// Client ID definitivo do projeto 854232017401
const GOOGLE_CLIENT_ID = "854232017401-djl9cldteppap81evo5gc8o8rg11kg5d.apps.googleusercontent.com";

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export function useGoogleDrive(appState: AppState, onStateUpdate: (newState: AppState) => void) {
  const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem('google_drive_access_token'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userAccount, setUserAccount] = useState<string | null>(localStorage.getItem('google_drive_user_email'));
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [currentOrigin] = useState(() => window.location.origin);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  // Inicializa Google Picker API
  useEffect(() => {
    const loadPicker = () => {
      if (window.gapi) {
        window.gapi.load('picker', { callback: () => setPickerApiLoaded(true) });
      } else {
        setTimeout(loadPicker, 500);
      }
    };
    loadPicker();
  }, []);

  const handleOpenPicker = () => {
    const token = localStorage.getItem('google_drive_access_token');
    if (!token) {
        setError("Conecte ao Google Drive primeiro.");
        return;
    }

    if (!pickerApiLoaded) {
        setError("O Selecionador de Pastas ainda está carregando...");
        return;
    }

    try {
        const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
            .setSelectableMimeTypes('application/vnd.google-apps.folder')
            .setMimeTypes('application/vnd.google-apps.folder');

        const picker = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setCallback((data: any) => {
                if (data.action === window.google.picker.Action.PICKED) {
                    const doc = data.docs[0];
                    const folderId = doc.id;
                    const folderName = doc.name;
                    
                    onStateUpdate({
                        ...appState,
                        syncFolderName: folderName,
                        syncFolderId: folderId
                    });
                }
            })
            .build();
        picker.setVisible(true);
    } catch (e: any) {
        setError("Erro ao abrir seletor: " + e.message + ". Certifique-se de estar em uma Janela Isolada.");
    }
  };

  // Inicializa o cliente do Google GIS e captura retorno de redirecionamento
  useEffect(() => {
    // Captura token do URL hash (Modo redirecionamento)
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            localStorage.setItem('google_drive_access_token', token);
            localStorage.setItem('google_drive_connected_at', Date.now().toString());
            setIsConnected(true);
            setError(null);
            fetchProfile(token);
            fetchFromDrive(token);
            // Limpa o hash da URL para ficar limpo
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
    }

    const initClient = () => {
      if (window.google && window.google.accounts) {
        try {
            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
              callback: (response: any) => {
                if (response.error) {
                  if (response.error === 'access_denied' || response.error === 'idpiframe_initialization_failed') {
                    setError("ERRO 403: Esta URL de Preview não está autorizada no seu Google Cloud Console.");
                  } else {
                    setError("Erro na autenticação: " + response.error);
                  }
                  return;
                }
                if (response.access_token) {
                  localStorage.setItem('google_drive_access_token', response.access_token);
                  localStorage.setItem('google_drive_connected_at', Date.now().toString());
                  setIsConnected(true);
                  setError(null);
                  fetchProfile(response.access_token);
                  fetchFromDrive(response.access_token);
                }
              },
              error_callback: (err: any) => {
                console.error("GIS Error Callback:", err);
                if (err.type === 'token_client_initialized' && err.message?.includes('403')) {
                     setError("Acesso negado (403). Esta URL de Preview não está autorizada nos 'Origens JavaScript' do seu projeto no Google Cloud.");
                }
              }
            });
            setTokenClient(client);
        } catch (e: any) {
            setError("Falha crítica no sistema Google: " + e.message);
        }
      } else {
        setTimeout(initClient, 1000);
      }
    };
    initClient();
  }, []);

  const fileName = appState.syncFileName || 'rpg_demons_despair.json';
  const folderName = appState.syncFolderName;

  const getFolderId = async (token: string, name: string) => {
    try {
      const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      
      // Criar pasta se não existe
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const newData = await createRes.json();
      return newData.id;
    } catch (e) {
      console.error("Erro ao gerenciar pasta", e);
      return null;
    }
  };

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserAccount(data.email);
        localStorage.setItem('google_drive_user_email', data.email);
      }
    } catch (e) { console.error("Erro ao carregar perfil", e); }
  };

  const handleGoogleConnect = (useRedirect: boolean = false) => {
    if (useRedirect) {
        const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email');
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;
        window.location.href = authUrl;
        return;
    }

    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      setError("O Google Drive está carregando. Tente novamente em 2 segundos.");
    }
  };

  const fetchFromDrive = useCallback(async (manualToken?: string) => {
    const token = manualToken || localStorage.getItem('google_drive_access_token');
    if (!token) return;

    setIsSyncing(true);
    try {
      let query = `name='${fileName}' and trashed=false`;
      
      const targetFolderId = appState.syncFolderId;
      
      if (targetFolderId) {
        query = `name='${fileName}' and '${targetFolderId}' in parents and trashed=false`;
      } else if (folderName) {
        const fId = await getFolderId(token, folderName);
        if (fId) {
          query = `name='${fileName}' and '${fId}' in parents and trashed=false`;
        }
      }

      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (listRes.status === 401) {
          setIsConnected(false);
          throw new Error("Sessão expirada. Reconecte o Drive.");
      }

      const listData = await listRes.json();
      const file = listData.files?.[0];

      if (file) {
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await contentRes.json();
        if (data) {
          onStateUpdate(data);
          setLastSync(new Date().toLocaleTimeString());
          setError(null);
        }
      } else {
        setError(`Arquivo "${fileName}" não encontrado${folderName ? ` na pasta "${folderName}"` : ""} no Drive.`);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao buscar do Drive.");
    } finally {
      setIsSyncing(false);
    }
  }, [onStateUpdate, fileName, folderName]);

  const syncToDrive = useCallback(async () => {
    const token = localStorage.getItem('google_drive_access_token');
    if (!token) return;

    setIsSyncing(true);
    try {
      let query = `name='${fileName}' and trashed=false`;
      let folderId: string | null = appState.syncFolderId || null;
      
      if (!folderId && folderName) {
        folderId = await getFolderId(token, folderName);
      }

      if (folderId) {
        query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
      }

      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (listRes.status === 401) {
          setIsConnected(false);
          throw new Error("Sessão expirada. Reconecte o Drive.");
      }

      const listData = await listRes.json();
      const file = listData.files?.[0];
      
      const metadata: any = { 
        name: fileName, 
        mimeType: 'application/json'
      };

      if (folderId) {
        metadata.parents = [folderId];
      }

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', new Blob([JSON.stringify(appState)], { type: 'application/json' }));

      if (file) {
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      } else {
        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      }

      setLastSync(new Date().toLocaleTimeString());
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar no Drive.");
    } finally {
      setIsSyncing(false);
    }
  }, [appState, fileName, folderName]);

  const handleLogout = () => {
    localStorage.removeItem('google_drive_access_token');
    localStorage.removeItem('google_drive_connected_at');
    localStorage.removeItem('google_drive_user_email');
    setIsConnected(false);
    setUserAccount(null);
    setLastSync(null);
  };

  const checkStatus = () => {
    const token = localStorage.getItem('google_drive_access_token');
    if (token) fetchFromDrive(token);
  };

  return {
    isConnected,
    isSyncing,
    lastSync,
    error,
    userAccount,
    fetchFromDrive,
    syncToDrive,
    handleLogout,
    handleGoogleConnect,
    handleOpenPicker,
    checkStatus,
    setError,
    currentOrigin
  };
}
