import { Character, Stats, ArmorPiece, Weapon, Item } from '../types';
import { MATERIALS, MaterialData } from '../data/materials';
import { createEmptyCharacter } from '../lib/character';
import { getVidaMaxima, getManaMaxima, getSanidadeMaxima } from '../rules/statusRules';
import { createWeaponFromMaterial, WEAPON_FORMULAS } from '../data/weaponFormulas';
import { ITEMS_LIBRARY } from '../data/items';
import { Scale } from '../rules/combatRules';
import { randomInt, randomElement, secureRandom } from '../lib/random';

export type EnemyDifficulty = 'fraco' | 'base' | 'forte';
export type EnemyType = 'mago' | 'corpo_a_corpo' | 'atirador';

interface StatWeights {
  [key: string]: number;
}

const TYPE_WEIGHTS: Record<EnemyType, StatWeights> = {
  mago: {
    INT: 0.4,
    RIT: 0.2,
    MEN: 0.15,
    APR: 0.1,
    ADP: 0.05,
    CON: 0.05,
    RES: 0.05,
  },
  corpo_a_corpo: {
    FOR: 0.25,
    DEX: 0.25,
    RES: 0.15,
    CON: 0.15,
    ADP: 0.15,
    INT: 0.05,
  },
  atirador: {
    DEX: 0.25,
    FOR: 0.25,
    CON: 0.15,
    RES: 0.1,
    APR: 0.1,
    ADP: 0.1,
    INT: 0.05,
  },
};

const DIFFICULTY_CONFIG = {
  fraco: { totalPoints: 40, CON: 5, maxMaterialLevel: 3, scale: 'D' as Scale },
  base: { totalPoints: 60, CON: 10, maxMaterialLevel: 5, scale: 'C' as Scale },
  forte: { totalPoints: 100, CON: 20, maxMaterialLevel: 7, scale: 'B' as Scale },
};

const HUMAN_NAMES = [
  'Aldric', 'Cedric', 'Roland', 'Lucien', 'Gareth', 'Osric', 'Tristan', 'Edrik', 'Alaric', 'Mathias',
  'Isolde', 'Evelyne', 'Beatrice', 'Helena', 'Elsbeth', 'Margot', 'Rowena', 'Seraphine', 'Astrid', 'Clarisse',
  'Takeda', 'Hoshino', 'Nakamura', 'Fujibayashi', 'Shiranui', 'Uesugi', 'Arakawa', 'Kirigaya', 'Minamoto', 'Tachibana',
  'Ayame', 'Kisaragi', 'Hoshizaki', 'Fujimoto', 'Shinonome', 'Takamura', 'Kanzaki', 'Kurosawa', 'Amagiri', 'Himura',
  'Jabari', 'Kwame', 'Sekou', 'Temba', 'Chisomo', 'Bakari', 'Obasi', 'Jelani', 'Tau', 'Kofi',
  'Amara', 'Zuri', 'Ayana', 'Imani', 'Nala', 'Sade', 'Makena', 'Eshe', 'Adanna', 'Nyah',
  'Arami', 'Cauê', 'Jandir', 'Ubiratan', 'Raoni', 'Potira', 'Iaci', 'Iracema', 'Moacir', 'Cauan',
  'Jaciara', 'Yara', 'Araci', 'Maiara', 'Inaê', 'Thainá', 'Janaína', 'Potyra', 'Ayla', 'Iandé',
  'Rostam', 'Daryush', 'Kaveh', 'Bahram', 'Cyrus', 'Jamshid', 'Nader', 'Farid', 'Samir', 'Arman',
  'Yasmin', 'Roxana', 'Leila', 'Shirin', 'Darya', 'Mahin', 'Setareh', 'Nasrin', 'Anahita', 'Tahmineh',
  'Branoc', 'Cormag', 'Eogan', 'Finley', 'Taliesin', 'Caelan', 'Ronan', 'Maelor', 'Taran', 'Alwyn',
  'Rhiannon', 'Niamh', 'Eira', 'Morrigan', 'Elowen', 'Keeva', 'Branwen', 'Maeve', 'Isleen', 'Arianrhod',
  'Leonidas', 'Nikandros', 'Alexandros', 'Theodoros', 'Lysandros', 'Cassian', 'Damon', 'Heliodoros', 'Orion', 'Perseus',
  'Thalassa', 'Helena', 'Selene', 'Cassandra', 'Nyx', 'Penelope', 'Ione', 'Eudora', 'Ariadne', 'Phoebe',
  'Viktor', 'Dieter', 'Heinrich', 'Katarina', 'Ingrid', 'Bjorn', 'Sigrid', 'Leofric', 'Freya', 'Ulrich',
  'Emeric', 'Baldwin', 'Leoric', 'Hadrian', 'Godfrey', 'Roderic', 'Etienne', 'Percival', 'Raimund', 'Theobald',
  'Sibylla', 'Ysoria', 'Melisande', 'Odette', 'Alwine', 'Cecily', 'Lucette', 'Fiora', 'Gwendolyn', 'Adelise',
  'Sakuraba', 'Kurogane', 'Shinjo', 'Hayashida', 'Amemiya', 'Tsukishiro', 'Morioka', 'Kisarazu', 'Ishikawa', 'Yukimura',
  'Ayanami', 'Mizuno', 'Kagetsu', 'Fujisaka', 'Asakura', 'Komori', 'Tachibana', 'Hanabira', 'Ootori', 'Shirakawa',
  'Malik', 'Tendai', 'Omari', 'Zuberi', 'Femi', 'Themba', 'Bhekizizwe', 'Salim', 'Ayo', 'Baraka',
  'Zainabu', 'Ifeoma', 'Halima', 'Chipo', 'Abeni', 'Nkiru', 'Lulama', 'Tariro', 'Sanaa', 'Kesia',
  'Aruan', 'Guaraci', 'Tupinã', 'Aimberê', 'Poti', 'Jurema', 'Yaciara', 'Iandira', 'Moema', 'Arani',
  'Cauari', 'Potiguara', 'Guaianá', 'Mayumi', 'Irani', 'Jacira', 'Yara', 'Inaçu', 'Aruê', 'Anahi',
  'Xerxes', 'Bahadur', 'Arash', 'Kamran', 'Shahin', 'Farrokh', 'Mehran', 'Vartan', 'Azad', 'Reza',
  'Delara', 'Soraya', 'Mina', 'Laleh', 'Niloufar', 'Parvaneh', 'Mitra', 'Arezou', 'Sahar', 'Taraneh',
  'Faolan', 'Cathal', 'Diarmaid', 'Lorcan', 'Aedric', 'Finnian', 'Padraig', 'Keiran', 'Tadhg', 'Senan',
  'Orlaith', 'Deirdre', 'Aoife', 'Fianna', 'Nessa', 'Brigid', 'Eithne', 'Liadan', 'Sorcha', 'Maevis',
  'Adrastos', 'Menelaos', 'Evander', 'Timon', 'Dorian', 'Kyros', 'Heron', 'Theron', 'Orestes', 'Zephyros',
  'Callista', 'Eirene', 'Lyssandra', 'Daphne', 'Melaina', 'Themis', 'Chloris', 'Nephele', 'Cyrene', 'Andromeda',
  'Sigmund', 'Reinhardt', 'Otto', 'Gertrud', 'Anselm', 'Hildegard', 'Wolfram', 'Klaus', 'Elsa', 'Ludovic'
];

const HUMAN_SURNAMES = [
  'Varnholt', 'Blackmere', 'Everwyn', 'D’Aubrec', 'Thornfield', 'Valemont', 'Ravenscar', 'Falkenhayn', 'Dunewall', 'Corven',
  'Mirevale', 'Rosethorn', 'Vaelmont', 'Crowmere', 'Wintermere', 'Ainsworth', 'Falkridge', 'Duvall', 'Hollowmere', 'Ironhart',
  'Ryuunosuke', 'Akifumi', 'Kaito', 'Renji', 'Haruto', 'Masanori', 'Daichi', 'Souta', 'Katsuro', 'Hiroshi',
  'Mizuhara', 'Reina', 'Kaede', 'Sayuri', 'Akari', 'Yui', 'Misaki', 'Emi', 'Hotaru', 'Aoi',
  'N’Komo', 'Adesina', 'Diarra', 'Zuberi', 'Kalema', 'N’Doye', 'Kamau', 'Okonkwo', 'Mbeki', 'Adeyemi',
  'N’Kasa', 'Diallo', 'M’Baye', 'Sekhoto', 'Abimbola', 'Kinte', 'Chibale', 'Tambwe', 'N’Zinga', 'Kambule',
  'Tupãmirim', 'Arariboia', 'Piatã', 'Anhangá', 'Guaraci', 'Aruanã', 'Jurema', 'Tupinambá', 'Aimberê', 'Jaguaruna',
  'Potiguara', 'Guainumbi', 'Ibirá', 'Aramirim', 'Guajajara', 'Aratiba', 'Ubiraci', 'Guaporé', 'Maracanã', 'Pirajá',
  'Farzan', 'Mehrdad', 'Ardeshir', 'Soroush', 'Navid', 'Parvaneh', 'Shahrokh', 'Azarman', 'Darvishi', 'Kourosh',
  'Soraya', 'Mehrnaz', 'Farrokhzad', 'Azadeh', 'Neyshabur', 'Parisa', 'Khorsandi', 'Behrouz', 'Zand', 'Rostami',
  'Aelwyn', 'Dunraith', 'Whitestag', 'Morcant', 'Briarthorn', 'Oakenmoor', 'Draigwyn', 'Ravenshade', 'Glenfallow', 'Mistmere',
  'Valewyn', 'Silverbrook', 'Thornvale', 'Ashdown', 'Fairbriar', 'Nightfern', 'Hollowmere', 'Stormrest', 'Moonbrook', 'Everdawn',
  'Theron', 'Phokas', 'Melanthios', 'Kyrene', 'Drakon', 'Ptolemaios', 'Argyros', 'Kastor', 'Kallicrates', 'Xenon',
  'Andromache', 'Mykene', 'Damaris', 'Ikarion', 'Callidora', 'Thaleia', 'Melantha', 'Lysippe', 'Koronis', 'Xanthe',
  'Eisenwald', 'Falkrune', 'Valdmar', 'Weisshart', 'Von Drachen', 'Halvorsen', 'Wolfskar', 'Ashenford', 'Stormhild', 'Grimward',
  'Valgrave', 'Mirecourt', 'Ashcombe', 'Vexley', 'Thornhelm', 'Vayne', 'Corbray', 'Dunlor', 'Falkmere', 'Ravencrest',
  'Valecourt', 'Blackthorn', 'Viremont', 'Ravenshire', 'Duskmere', 'Ardenvale', 'Ironveil', 'Wintercrest', 'Harrowmere', 'Montclair',
  'Itsuki', 'Tetsuya', 'Kazuma', 'Naoki', 'Riku', 'Haruki', 'Genji', 'Tomoya', 'Raiden', 'Shinji',
  'Kohana', 'Shizuka', 'Rin', 'Nozomi', 'Hina', 'Suzume', 'Mei', 'Chiyo', 'Nanami', 'Izumi',
  'Jabari', 'Chikosi', 'Kessé', 'Katembo', 'Balogun', 'N’Dala', 'Moyo', 'Kinteh', 'Banyarwanda', 'Lumumba',
  'Kambale', 'Dlamini', 'N’Djoko', 'Makalani', 'Folorunso', 'Tembeka', 'Sefako', 'Chuma', 'Kambizi', 'Mandla',
  'Ibirapitá', 'Poty', 'Ybyrá', 'Jatobá', 'Anhanguera', 'Araticum', 'Ubiratã', 'Guaporã', 'Piratã', 'Caaporã',
  'Jandira', 'Aramã', 'Itaporã', 'Tainá', 'Guarajá', 'Aimoré', 'Potira', 'Aruanã', 'Tupiná', 'Maraguá',
  'Arvand', 'Kiyan', 'Vahid', 'Esfandiar', 'Daryan', 'Samand', 'Zoraster', 'Ramin', 'Pahlavan', 'Bahmani',
  'Shabani', 'Khatun', 'Ardeshiri', 'Zarrin', 'Kamyab', 'Shirazi', 'Davani', 'Farahani', 'Rostamian', 'Mehrabi',
  'Briarwyn', 'Stormmere', 'Oakhallow', 'Frostvale', 'Moonthorn', 'Greymoor', 'Elderfern', 'Ashvale', 'Ravenshade', 'Wildbrook',
  'Windmere', 'Starbloom', 'Briarcrest', 'Glenwyn', 'Hollowfern', 'Fairthorn', 'Silvermist', 'Mossbrook', 'Embervale', 'Dawnmere',
  'Kyriakos', 'Thestor', 'Niketas', 'Aegeon', 'Myrmidon', 'Alkeides', 'Xanthos', 'Pelagius', 'Damarion', 'Iason',
  'Nymeria', 'Thespia', 'Korinth', 'Kalliope', 'Rhodopis', 'Asteria', 'Eudokia', 'Selachne', 'Philomela', 'Lysandra',
  'Eisenfaust', 'Volkmar', 'Grimwald', 'Falkenrath', 'Drechsler', 'Weisshorn', 'Nachtberg', 'Dornheim', 'Kriegerwald', 'Steinmark'
];

export class EnemyGeneratorService {
  private static shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  static generateEnemy(difficulty: EnemyDifficulty, type: EnemyType, name?: string, customMaterials?: MaterialData[]): Character {
    const config = DIFFICULTY_CONFIG[difficulty];
    const enemy = createEmptyCharacter();
    
    enemy.id = crypto.randomUUID();
    
    if (name) {
      enemy.nome = name;
    } else {
      const first = randomElement(HUMAN_NAMES);
      const last = randomElement(HUMAN_SURNAMES);
      enemy.nome = `${first} ${last} (${this.capitalize(difficulty)})`;
    }
    
    // Define base material pool: merge custom with system ensuring custom materials override system originals by ID
    const mergedMaterials = [
      ...MATERIALS.filter(bm => !(customMaterials || []).some(cm => cm.id === bm.id)),
      ...(customMaterials || [])
    ];

    const baseMaterials = mergedMaterials
      .filter(m => {
        if (m.ignorarNoGerador) return false;
        const id = m.id.toLowerCase();
        const blacklist = ['estanho', 'mercúrio'];
        if (blacklist.includes(id)) return false;
        return true;
      });

    // Generate Equipment Pool
    const availableMaterials = baseMaterials.filter(m => {
      const level = Math.max(m.corte.fisico, m.perfuracao.fisico, m.impacto.fisico);
      return level <= config.maxMaterialLevel;
    });

    // If for some reason the filtered pool is empty, use the whole system list as fallback (but still respect ignore flag)
    const safetyPool = availableMaterials.length > 0 ? availableMaterials : baseMaterials;
    
    // Shuffle the pool once for the session
    const finalMaterialPool = this.shuffle(safetyPool);
    
    // Choose primary weapon first to help with stat distribution for melee
    const formulas = Object.keys(WEAPON_FORMULAS);
    const rangedFormulas = formulas.filter(f => 
      f.toLowerCase().includes('arco') || 
      f.toLowerCase().includes('besta') || 
      f.toLowerCase().includes('pistola') ||
      f.toLowerCase().includes('rifle') ||
      f.toLowerCase().includes('revólver') ||
      f.toLowerCase().includes('espingarda')
    );
    const meleeFormulas = formulas.filter(f => !rangedFormulas.includes(f) && !f.toLowerCase().includes('arremesso') && !f.toLowerCase().includes('shuriken'));
    const throwingFormulas = formulas.filter(f => f.toLowerCase().includes('arremesso') || f.toLowerCase().includes('shuriken') || f.toLowerCase().includes('pilum'));

    let primaryWeaponFormula = '';
    if (type === 'atirador') {
      primaryWeaponFormula = randomElement(rangedFormulas) || 'Arco curto';
    } else if (type === 'corpo_a_corpo' || type === 'mago') {
      primaryWeaponFormula = randomElement(meleeFormulas) || 'Espada curta';
    } else {
      primaryWeaponFormula = randomElement(formulas);
    }

    // Determine primary stat for melee
    let meleePrimaryStat: 'FOR' | 'DEX' | undefined;
    if (type === 'corpo_a_corpo') {
      const formula = WEAPON_FORMULAS[primaryWeaponFormula];
      meleePrimaryStat = formula?.atributoBase === 'Força' ? 'FOR' : 'DEX';
    }

    // Distribute Stats
    enemy.stats = this.distributeStats(config.totalPoints, config.CON, type, meleePrimaryStat);
    
    // Set Vitals
    enemy.vidaAtual = getVidaMaxima(enemy.stats.CON);
    enemy.manaAtual = getManaMaxima(enemy.stats.APR);
    enemy.sanidadeAtual = getSanidadeMaxima(enemy.stats.MEN);
    
    // Set Appearance / Etnia randomly
    const localEtnias = ['Humano', 'Vilae', 'Elder'];
    enemy.etnia = randomElement(localEtnias);

    // 1 to 2 weapons with individual materials
    const numWeapons = randomInt(1, 2);
    let hasRanged = false;
    
    for (let i = 0; i < numWeapons; i++) {
        let formulaKey: string;
        
        if (i === 0) {
          formulaKey = primaryWeaponFormula;
        } else {
          // Secondary weapon has 40% chance of being throwing, otherwise random from appropriate pool
          if (secureRandom() < 0.4) {
            formulaKey = randomElement(throwingFormulas);
          } else if (type === 'atirador') {
            formulaKey = randomElement([...meleeFormulas, ...throwingFormulas]);
          } else if (type === 'corpo_a_corpo') {
            // Melee second weapon: 50% throwing, 50% other melee
            formulaKey = secureRandom() > 0.5 ? randomElement(throwingFormulas) : randomElement(meleeFormulas);
          } else {
            formulaKey = randomElement(formulas);
          }
        }

        const isThrowing = formulaKey.toLowerCase().includes('arremesso') || formulaKey.toLowerCase().includes('shuriken') || formulaKey.toLowerCase().includes('pilum');
        
        // Pick material for weapon from pre-shuffled pool
        const weaponMaterials = finalMaterialPool.filter(m => {
          if (isThrowing) {
            return !['madeira', 'pedra', 'mercúrio', 'ouro'].includes(m.id.toLowerCase()) && 
                   !['madeira', 'pedra', 'mercúrio', 'ouro'].includes(m.nome.toLowerCase());
          }
          return true;
        });

        const weaponMat = randomElement(weaponMaterials) || randomElement(finalMaterialPool);
        if (!weaponMat) throw new Error("No weapon material available");
        const weapon = createWeaponFromMaterial(formulaKey, weaponMat);
        
        const isFirearm = formulaKey.toLowerCase().includes('pistola') || 
                         formulaKey.toLowerCase().includes('rifle') || 
                         formulaKey.toLowerCase().includes('revólver') || 
                         formulaKey.toLowerCase().includes('espingarda');

        // Override scale based on difficulty
        weapon.escala = isFirearm ? "0" : config.scale;

        const isBowOrCrossbow = formulaKey.toLowerCase().includes('arco') || formulaKey.toLowerCase().includes('besta');

        if (isFirearm || isBowOrCrossbow) {
          hasRanged = true;
          weapon.corte = 0;
          weapon.impacto = 0;
          weapon.perfuracao = 0;
          weapon.resistencia = 0;
          
          if (isFirearm) {
            weapon.categoria = 'Arma de Fogo';
            weapon.municaoTotal = randomInt(6, 12);
            weapon.municaoCarregada = 6;
            weapon.durabilidadeMaxUtil = weapon.maxDurabilidade;
          }
        }
        
        if (isThrowing) {
          const count = randomInt(5, 15);
          enemy.armas.push({ ...weapon, quantidade: count });
        } else {
          enemy.armas.push({ ...weapon, quantidade: 1 });
        }
    }

    // Initial weight logic...
    this.generateInventory(enemy, type, hasRanged, finalMaterialPool, difficulty);

    // Initial weight tracking
    let currentWeight = 0;
    const maxWeight = 300 + (enemy.stats.RES * 5);

    // Recalculate weight from initial items
    enemy.compartimentos.forEach(comp => {
      comp.itens.forEach(item => {
        currentWeight += (item.peso || 0) * (item.quantidade || 1);
      });
    });

    // Initial weight from weapons
    enemy.armas.forEach(w => {
      currentWeight += (w.peso || 0) * (w.quantidade || 1);
    });

    // Generate Full Set logic
    this.generateFullArmorSet(enemy, availableMaterials, finalMaterialPool, difficulty, currentWeight, maxWeight, baseMaterials);

    // Final check for Shooters to ensure FOR and DEX are exactly equal
    if (type === 'atirador') {
      const avg = Math.floor((enemy.stats.FOR + enemy.stats.DEX) / 2);
      enemy.stats.FOR = avg;
      enemy.stats.DEX = avg;
    }

    return this.cleanObject(enemy);
  }

  private static cleanObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObject(item));
    } else if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
          newObj[key] = this.cleanObject(obj[key]);
        }
      });
      return newObj;
    }
    return obj;
  }

  private static generateInventory(enemy: Character, type: EnemyType, hasRanged: boolean, materials: MaterialData[], difficulty: EnemyDifficulty) {
    // Ensure we have a backpack with correct capacity
    if (!enemy.compartimentos || enemy.compartimentos.length === 0) {
      enemy.compartimentos = [
        { id: crypto.randomUUID(), nome: "Mochila de viagem", volumeMax: 50, itens: [], externo: false },
        { id: crypto.randomUUID(), nome: "Bolsa de cinto", volumeMax: 3, itens: [], externo: false }
      ];
    } else {
      // Fix zero volume capacity from defaults
      enemy.compartimentos.forEach(comp => {
        if (comp.nome.includes("Mochila") && comp.volumeMax === 0) comp.volumeMax = 50;
        if (comp.nome.includes("Bolsa") && comp.volumeMax === 0) comp.volumeMax = 3;
      });
    }
    
    const mochila = enemy.compartimentos[0]; // Items still go to the main backpack

    // Money Generation - goes to character's wallet
    let money = { C: 0, B: 0, P: 0, O: 0 };
    if (difficulty === 'fraco') {
      money.C = randomInt(1, 20);
    } else if (difficulty === 'base') {
      money.C = randomInt(1, 20);
      money.B = randomInt(1, 10);
    } else if (difficulty === 'forte') {
      money.B = randomInt(1, 20);
      money.P = randomInt(1, 2);
    } else {
      money.B = 10;
    }
    enemy.dinheiro = money;

    // 1 to 3 generic items from library
    const numItems = randomInt(1, 3);
    const libraryItems = ITEMS_LIBRARY.filter(i => i.tipo !== 'municao' && i.tipo !== 'equipamento');
    
    for (let i = 0; i < numItems; i++) {
      const baseItem = randomElement(libraryItems);
      if (!baseItem) continue;

      if (baseItem.nome === "Dinheiro extra") {
        enemy.dinheiro.P += 1;
        continue;
      }

      mochila.itens.push({
        id: crypto.randomUUID(),
        nome: baseItem.nome,
        peso: baseItem.peso,
        volume: baseItem.volume,
        quantidade: baseItem.quantidade || 1,
        tipo: baseItem.tipo === 'consumivel' ? 'Consumível' : 'Utilitário',
        durabilidade: 10,
        maxDurabilidade: 10,
        descricao: baseItem.descricao,
        efeito: baseItem.efeito || ''
      });
    }

    // Ammo for shooters (10 to 20)
    if (hasRanged) {
      const rangedWeapon = enemy.armas.find(w => 
        w.nome.toLowerCase().includes('arco') || 
        w.nome.toLowerCase().includes('besta') || 
        w.nome.toLowerCase().includes('pistola') || 
        w.nome.toLowerCase().includes('rifle')
      );

      const isFirearm = rangedWeapon?.nome.toLowerCase().includes('pistola') || rangedWeapon?.nome.toLowerCase().includes('rifle');
      
    // Pick individual material for ammo to ensure variety
    const ammoMatPool = this.shuffle([...materials]);
    let ammoMat = randomElement(ammoMatPool.filter(m => 
      !['madeira', 'ouro', 'mercúrio', 'estanho'].includes(m.id.toLowerCase())
    ));
    
    if (!ammoMat) throw new Error("No ammo material available");
    const baseAmmo = ITEMS_LIBRARY.find(i => i.nome.includes(isFirearm ? 'Balas' : 'Flechas')) || ITEMS_LIBRARY.find(i => i.tipo === 'municao');

      if (baseAmmo) {
        mochila.itens.push({
          id: crypto.randomUUID(),
          nome: isFirearm ? `Balas de ${ammoMat.nome}` : `Flechas de ${ammoMat.nome}`,
          peso: baseAmmo.peso,
          volume: baseAmmo.volume,
          quantidade: randomInt(10, 20),
          tipo: 'Munição',
          durabilidade: 10,
          maxDurabilidade: 10,
          corte: ammoMat.corte.fisico,
          impacto: ammoMat.impacto.fisico,
          perfuracao: ammoMat.perfuracao.fisico,
          resistencia: ammoMat.resistencia.fisico,
          descricao: baseAmmo.descricao,
          efeito: ammoMat.efeitos.join(", ")
        });
      }
    }
  }

  private static generateFullArmorSet(enemy: Character, availableMaterials: MaterialData[], fallbackPool: MaterialData[], difficulty: EnemyDifficulty, initialWeight: number, maxWeight: number, baseMaterials: MaterialData[]) {
    const sets = [
      { 
        nome: 'Couro', 
        rd: -1,
        parts: [
          { nome: 'Peitoral parcial', peso: 30, vol: 10, member: 'Tronco' },
          { nome: 'Braçadeiras', peso: 5, vol: 6, member: 'Braços' },
          { nome: 'Grevas', peso: 15, vol: 8, member: 'Pernas' }
        ]
      },
      { 
        nome: 'Simples', 
        rd: -3,
        parts: [
          { nome: 'Capacete', peso: 30, vol: 4, member: 'Cabeça' },
          { nome: 'Peitoral parcial', peso: 50, vol: 10, member: 'Tronco' },
          { nome: 'Braçadeiras', peso: 15, vol: 6, member: 'Braços' },
          { nome: 'Grevas', peso: 20, vol: 8, member: 'Pernas' }
        ]
      },
      { 
        nome: 'Malha', 
        rd: -2,
        isMalha: true,
        parts: [
          { nome: 'Manto de malha', peso: 30, vol: 4, member: 'Tronco' }
        ]
      },
      { 
        nome: 'Placas', 
        rd: -5,
        isPlacas: true,
        parts: [
          { nome: 'Peitoral de placas', peso: 70, vol: 15, member: 'Tronco' },
          { nome: 'Pernas de placas', peso: 30, vol: 8, member: 'Pernas' },
          { nome: 'Capacete de placas', peso: 35, vol: 4, member: 'Cabeça' },
          { nome: 'Rebraço de placas', peso: 20, vol: 6, member: 'Braços' },
          { nome: 'Manoplas de placas', peso: 5, vol: 2, member: 'Braços' },
          { nome: 'Botas de placas', peso: 5, vol: 2, member: 'Pernas' }
        ]
      }
    ];

    let currentWeight = initialWeight;

    // Pick set based on difficulty or random
    let selectedSet: any;
    if (difficulty === 'fraco') {
      selectedSet = secureRandom() > 0.5 ? sets[0] : sets[1]; // Leather or Simple
    } else {
      // Forte/Base can use anything, but favor better sets
      const setPool = difficulty === 'forte' ? sets.slice(1) : sets;
      selectedSet = randomElement(setPool);
    }
    
    // Reset defense
    enemy.defesa = { ...enemy.defesa, "Cabeça": 0, "Tronco": 0, "Braço Esquerdo": 0, "Braço Direito": 0, "Pernas": 0 };

    // Material logic based on set
    let matPool: MaterialData[];
    const isLeather = selectedSet.nome.toLowerCase().includes('couro');
    
    if (isLeather) {
      // Preferably biological/organic materials
      matPool = availableMaterials.filter(m => 
        ['madeira', 'dragão', 'osmium', 'pederneira', 'pedra', 'escama', 'osso', 'couro'].some(term => m.nome.toLowerCase().includes(term) || m.id.toLowerCase().includes(term))
      );
    } else {
      // Preferably metallic materials
      matPool = availableMaterials.filter(m => 
        !['madeira', 'pedra', 'pederneira'].some(term => m.nome.toLowerCase().includes(term))
      );
    }

    // Fallback: if thematic pool is empty, use all available for this level
    if (matPool.length === 0) matPool = [...availableMaterials];
    // Final safety: if level pool is empty (shouldn't happen with ferro present), use total pool
    if (matPool.length === 0) matPool = [...baseMaterials];
    
    // Final shuffle to ensure variety across pieces
    matPool = this.shuffle(matPool);

    selectedSet.parts.forEach((part: any) => {
      // Each piece of the set gets its OWN random draw from the material pool
      const mat = randomElement(matPool);
      if (!mat) throw new Error(`No armor material available for part ${part.nome}`);

      let matDur = parseInt(mat.durabilidade);
      if (isNaN(matDur)) matDur = 5;

      let finalDur = matDur;
      
      let corte = mat.corte.fisico;
      let impacto = mat.impacto.fisico;
      let perfuracao = mat.perfuracao.fisico;

      if (selectedSet.isMalha) {
        finalDur = Math.max(1, Math.floor(matDur * 0.8));
      } else if (selectedSet.isPlacas) {
        finalDur = matDur + 2;
      }

      // Material weight effect: doubles if pesado, halves if leve
      let pieceWeight = part.peso;
      if (mat.isPesado) {
        pieceWeight *= 2;
      } else if (mat.isLeve || mat.efeitos.some(e => e.toLowerCase().includes('leve'))) {
        pieceWeight *= 0.5;
      }

      // Check weight limit
      if (currentWeight + pieceWeight > maxWeight) {
        return; // Skip this piece if it exceeds limit
      }

      const piece: ArmorPiece = {
        id: crypto.randomUUID(),
        nome: `${part.nome} de ${mat.nome}`,
        corte,
        impacto,
        perfuracao,
        durabilidade: finalDur,
        peso: pieceWeight,
        volume: part.vol,
        reducaoDano: selectedSet.rd,
        efeito: mat.efeitos.join(", ")
      };

      enemy.armaduras.push(piece);
      currentWeight += pieceWeight;

      // Apply RD to specific members
      if (part.member === 'Cabeça') enemy.defesa["Cabeça"] = selectedSet.rd;
      if (part.member === 'Tronco') enemy.defesa["Tronco"] = selectedSet.rd;
      if (part.member === 'Braços') {
        enemy.defesa["Braço Esquerdo"] = selectedSet.rd;
        enemy.defesa["Braço Direito"] = selectedSet.rd;
      }
      if (part.member === 'Pernas') {
        enemy.defesa["Pernas"] = selectedSet.rd;
      }
    });
  }

  private static distributeStats(totalPoints: number, minCON: number, type: EnemyType, meleePrimaryStat?: 'FOR' | 'DEX'): Stats {
    const stats: Stats = {
      CON: minCON,
      RES: 0,
      ADP: 0,
      MEN: 0,
      APR: 0,
      FOR: 0,
      DEX: 0,
      INT: 0,
      RIT: 0,
    };

    // Requirement: Shooters (Atirador) balanced FOR and DEX
    if (type === 'atirador') {
      stats.FOR = 10;
      stats.DEX = 10;
    }

    // Requirement: Melee (Corpo a corpo) favor specified stat
    if (type === 'corpo_a_corpo') {
      if (meleePrimaryStat === 'FOR') stats.FOR = 15;
      else if (meleePrimaryStat === 'DEX') stats.DEX = 15;
      else {
        if (secureRandom() > 0.5) stats.FOR = 15;
        else stats.DEX = 15;
      }
    }

    let remainingPoints = totalPoints - Object.values(stats).reduce((a, b) => a + b, 0);
    if (remainingPoints < 0) remainingPoints = 0;

    const weights = { ...TYPE_WEIGHTS[type] };
    
    // Adjustment: favor primary stat more heavily for Melee, and balance strictly for Shooters
    if (type === 'corpo_a_corpo' && meleePrimaryStat) {
      if (meleePrimaryStat === 'FOR') {
        weights.FOR = 0.50;
        weights.DEX = 0.10;
        weights.RES = 0.15;
      } else {
        weights.DEX = 0.50;
        weights.FOR = 0.10;
        weights.RES = 0.15;
      }
    }

    const statKeys = Object.keys(stats) as (keyof Stats)[];
    
    // Initial distribution based on weights
    while (remainingPoints > 0) {
      for (const key of statKeys) {
        if (remainingPoints <= 0) break;
        
        let targetKey = key;
        
        // For Atirador, strictly keep FOR and DEX equal
        if (type === 'atirador' && (key === 'FOR' || key === 'DEX')) {
          if (stats.FOR < stats.DEX) targetKey = 'FOR';
          else if (stats.DEX < stats.FOR) targetKey = 'DEX';
          // If equal, random between them
          else targetKey = secureRandom() > 0.5 ? 'FOR' : 'DEX';
        }
        
        const weight = weights[key as keyof typeof weights] || 0.05; 
        if (secureRandom() < weight) { 
          (stats as any)[targetKey]++;
          remainingPoints--;
        }
      }
    }

    return stats;
  }

  private static capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
