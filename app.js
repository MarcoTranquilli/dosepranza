import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, getDocs, runTransaction, doc, where, limit, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // --- DATABASE PRODOTTI COMPLETO ---
        const DIETS_CONFIG = { "carne/pesce": "🥩 Carne/Pesce", "vegetariano": "🧀 Vegetariano", "vegano": "🌱 Vegano" };
        const CATEGORIES = ["Menù Combinati", "Gastronomia", "Insalatone", "Verdure", "Fritti", "Panini", "Pizze", "Dessert", "Prodotti da Forno"];
        const INGREDIENTS_DATA = [{id:'br',name:'Bresaola'},{id:'bi',name:'Brie'},{id:'bl',name:'Broccoletti'},{id:'cp',name:'Capocollo'},{id:'cr',name:'Carciofini'},{id:'ci',name:'Cicoria'},{id:'fr',name:'Frittata'},{id:'in',name:'Insalata'},{id:'lt',name:'Lattuga'},{id:'mg',name:'Melanzane Grigliate'},{id:'mo',name:'Mortadella'},{id:'mz',name:'Mozzarella'},{id:'ol',name:'Olive'},{id:'pa',name:'Parmigiano'},{id:'pe',name:'Pecorino'},{id:'pg',name:'Peperoni Grigliati'},{id:'ps',name:'Pomodori Secchi'},{id:'po',name:'Pomodoro'},{id:'pc',name:'Porchetta'},{id:'pr',name:'Primo Sale'},{id:'co',name:'Prosciutto Cotto'},{id:'cu',name:'Prosciutto Crudo'},{id:'ru',name:'Rucola'},{id:'sa',name:'Salame'},{id:'sc',name:'Scamorza'},{id:'sk',name:'Scarola'},{id:'sp',name:'Speck'},{id:'st',name:'Stracchino'},{id:'sz',name:'Stracciatella'},{id:'ta',name:'Tacchino Arrosto'},{id:'zg',name:'Zucchine Grigliate'}].sort((a,b)=>a.name.localeCompare(b.name));

        const FRIGE_DEFAULTS = [
            { name: "Lasagna classica al ragù (250-300g)", price: 6.0, stock: 6 },
            { name: "Lasagna bianca vegetariana ai carciofi (250-300g)", price: 6.0, stock: 6 },
            { name: "Melanzane alla parmigiana (grigliate, 250-300g)", price: 6.0, stock: 6 },
            { name: "Cous cous vegetale", price: 4.0, stock: 8 },
            { name: "Riso Venere con gamberi e zucchine", price: 4.0, stock: 8 },
            { name: "Insalata di riso", price: 4.0, stock: 8 },
            { name: "Pasta fredda con tonno pomodori e olive", price: 4.0, stock: 8 },
            { name: "Insalatona con Tonno", price: 5.0, stock: 6 },
            { name: "Insalatona con Uovo Sodo", price: 5.0, stock: 6 },
            { name: "Macedonia", price: 3.0, stock: 8 }
        ];

        const RAW_MENU = {
            "Gastronomia": [
                { name: "Melanzane alla parmigiana (grigliate, 250-300g)", price: 6.0, desc: "Grigliate (250-300g)", diet: ["vegetariano"] },
                { name: "Lasagna classica al ragù (250-300g)", price: 6.0, desc: "Sfoglia all'uovo (250-300g)", diet: ["carne/pesce"] },
                { name: "Lasagna bianca vegetariana ai carciofi (250-300g)", price: 6.0, desc: "Sfoglia all'uovo (250-300g)", diet: ["vegetariano"] },
                { name: "Lasagna funghi salsiccia", price: 6.0, desc: "Besciamella e salsiccia (250-300g)", diet: ["carne/pesce"] },
                { name: "Cous cous vegetale con pollo", price: 4.0, diet: ["carne/pesce"] },
                { name: "Cous cous vegetale", price: 4.0, diet: ["vegano"] },
                { name: "Riso Venere con gamberi e zucchine", price: 4.0, diet: ["carne/pesce"] },
                { name: "Insalata di riso", price: 4.0, desc: "Wurstel, uova, olive", diet: ["carne/pesce"] },
                { name: "Pasta fredda con tonno pomodori e olive", price: 4.0, diet: ["carne/pesce"] },
                { name: "Pasta fredda pesto primo sale pomodori olive", price: 4.0, diet: ["vegetariano"] },
                { name: "Riso integrale bresaola limone e rughetta", price: 4.0, diet: ["carne/pesce"] },
                { name: "Frittata e zucchine", price: 4.0, diet: ["vegetariano"] },
                { name: "Lasagna bianca funghi piselli e salsiccia (250-300g)", price: 6.0, desc: "Besciamella e salsiccia (250-300g)", diet: ["carne/pesce"] },
                { name: "Insalata di pollo", price: 4.0, diet: ["carne/pesce"] },
                { name: "Farro vegetale con salmone", price: 4.0, diet: ["carne/pesce"] },
                { name: "Farro vegetale", price: 4.0, diet: ["vegano"] },
                { name: "Pomodori con il riso (2 pz)", price: 6.0, desc: "Con patate al forno", diet: ["vegano"] },
                { name: "Pomodori con riso e patate (a peso)", price: 6.0, desc: "A peso", diet: ["vegano"] },
                { name: "Ovoline di bufala 150g", price: 1.0, diet: ["vegetariano"] }
            ],
            "Insalatone": [
                { name: "Insalatona con Uovo Sodo", price: 5.0, diet: ["vegetariano"] },
                { name: "Insalatona con Primo Sale", price: 5.0, diet: ["vegetariano"] },
                { name: "Insalatona con Tonno", price: 5.0, diet: ["carne/pesce"] }
            ],
            "Verdure": [
                { name: "Melanzane grigliate", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] },
                { name: "Zucchine grigliate", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] },
                { name: "Peperoni arrostiti", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] },
                { name: "Cicoria ripassata", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] },
                { name: "Broccoletti ripassati", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] },
                { name: "Broccoli al vapore", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] },
                { name: "Scarola con olive", price: 2.0, hasPortions:true, portions:[{t:"100g-2€",v:2.0},{t:"150g-3€",v:3.0},{t:"200g-4€",v:4.0}], diet:["vegano"] }
            ],
            "Fritti": [
                { name: "Supplì", price: 1.5, diet:["vegetariano"] },
                { name: "Polpetta di melanzane", price: 1.5, diet:["vegetariano"] },
                { name: "Pizzetta rossa", price: 1.5, hasPortions:true, portions:[{t:"2pz-1.5€",v:1.5},{t:"3pz-2€",v:2.0},{t:"6pz-4€",v:4.0}], diet:["vegetariano"] },
                { name: "Lingua romana scrocchiarella", price: 1.5, diet:["vegano"] }
            ],
            "Panini": [
                { name: "Crudo pomodoro mozzarella", price: 3.5, diet:["carne/pesce"] },
                { name: "Crudo stracchino rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Cotto arrosto scamorza e verdura", price: 3.5, diet:["carne/pesce"] },
                { name: "Capocollo pecorino e pomodori secchi", price: 3.5, diet:["carne/pesce"] },
                { name: "Porchetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Bresaola parmigiano e rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Tonno e pomodoro", price: 3.5, diet:["carne/pesce"] },
                { name: "Tonno e carciofini", price: 3.5, diet:["carne/pesce"] },
                { name: "Brasato di manzo e verdura", price: 3.5, diet:["carne/pesce"] },
                { name: "Brasato di manzo e verdura cotta", price: 3.5, diet:["carne/pesce"] },
                { name: "Crudo e mozzarella", price: 3.5, diet:["carne/pesce"] },
                { name: "Cotto arrosto e melanzane", price: 3.5, diet:["carne/pesce"] },
                { name: "Cotto e stracchino", price: 3.5, diet:["carne/pesce"] },
                { name: "Speck stracchino e rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Speck Brie e pomodori secchi", price: 3.5, diet:["carne/pesce"] },
                { name: "Salame pecorino e pomodori secchi", price: 3.5, diet:["carne/pesce"] },
                { name: "Mortadella e stracciatella", price: 3.5, diet:["carne/pesce"] },
                { name: "Salmone e formaggio", price: 3.5, diet:["carne/pesce"] },
                { name: "Bresaola e formaggio", price: 3.5, diet:["carne/pesce"] },
                { name: "Bresaola primo sale e rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Tacchino arrosto e verdura", price: 3.5, diet:["carne/pesce"] },
                { name: "Tacchino e verdura", price: 3.5, diet:["carne/pesce"] },
                { name: "Fesa di tacchino e verdura", price: 3.5, diet:["carne/pesce"] },
                { name: "Cotoletta di pollo lattuga e pomodoro", price: 3.5, diet:["carne/pesce"] },
                { name: "Vegetariano melanzane zucchine e peperoni", price: 3.5, diet:["vegano"] },
                { name: "5 Cereali con Zucchine Grigliate, Primo Sale, Pomodori Secchi", price: 3.5, diet:["vegetariano"] },
                { name: "Pane ai 5 cereali con tacchino e zucchine o scarola", price: 3.5, diet:["carne/pesce"] },
                { name: "Pane ai 5 cereali con formaggio spalmabile e salmone", price: 3.5, diet:["carne/pesce"] }
            ],
            "Pizze": [
                { name: "Pizza con insalata di pollo con maionese", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza classica con bresaola, filadelfia e rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza con tacchino e verdure", price: 3.5, diet:["carne/pesce"] },
                { name: "Crudo e mozzarella", price: 3.5, diet:["carne/pesce"] },
                { name: "Speck stracchino e rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Cotto arrosto e melanzane", price: 3.5, diet:["carne/pesce"] },
                { name: "Mortadella e stracciatella", price: 3.5, diet:["carne/pesce"] },
                { name: "Frittata e zucchine", price: 3.5, diet:["vegetariano"] },
                { name: "Bresaola e formaggio", price: 3.5, diet:["carne/pesce"] },
                { name: "Cotto e stracchino", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza ai 5 cereali bresaola formaggio spalmabile e rughetta", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza ai 5 cereali con insalata di pollo", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza 5 Cereali con Stracchino, Zucchine Grigliate, Pomodori Secchi", price: 3.5, diet:["vegetariano"] },
                { name: "Pizza Classica con Mozzarella, Pomodoro, Prosciutto Crudo", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza Classica con Capocollo, Pecorino, Rucola, Stracciatella, Melanzane Grigliate, Pomodori Secchi", price: 3.5, diet:["carne/pesce"] },
                { name: "Pizza Rustica: Scarola e olive", price: 8.0, hasPortions:true, portions:[{t:"Intera-8€",v:8},{t:"Mezza-4€",v:4},{t:"1/4-2€",v:2}], diet:["vegano"] },
                { name: "Pizza Rustica: Cicoria e pachino", price: 8.0, hasPortions:true, portions:[{t:"Intera-8€",v:8},{t:"Mezza-4€",v:4},{t:"1/4-2€",v:2}], diet:["vegano"] },
                { name: "Pizza Rustica: Broccoli e salsiccia", price: 8.0, hasPortions:true, portions:[{t:"Intera-8€",v:8},{t:"Mezza-4€",v:4},{t:"1/4-2€",v:2}], diet:["carne/pesce"] }
            ],
            "Prodotti da Forno": [
                { name: "Pane di Lariano", price: 0.75, hasPortions:true, portions:[{t:"250g-0.75€",v:0.75},{t:"500g-1.50€",v:1.5}], diet:["vegano"] },
                { name: "Ciabatta", price: 1.00, hasPortions:true, portions:[{t:"250g-1.00€",v:1.0},{t:"1kg-4.00€",v:4.0}], diet:["vegano"] },
                { name: "Pizza Bianca", price: 1.80, hasPortions:true, portions:[{t:"200g-1.80€",v:1.80},{t:"1kg-9.00€",v:9.0}], diet:["vegano"] },
                { name: "Pizza Rossa", price: 2.00, hasPortions:true, portions:[{t:"200g-2.00€",v:2.00},{t:"1kg-10.00€",v:9.0}], diet:["vegano"] },
                { name: "Pizza Con patate", price: 2.00, hasPortions:true, portions:[{t:"200g-2.00€",v:2.00},{t:"1kg-10.00€",v:9.0}], diet:["vegano"] },
                { name: "Pizzette (mini)", price: 1.50, desc: "Mini pizze morbide", diet:["vegetariano"] },
                { name: "Pizzetta rossa", price: 1.5, hasPortions:true, portions:[{t:"2pz-1.5€",v:1.5},{t:"3pz-2€",v:2.0},{t:"6pz-4€",v:4.0}], diet:["vegetariano"] },
                { name: "Lingua romana scrocchiarella", price: 1.5, diet:["vegano"] }
            ],
            "Dessert": [
                { name: "Macedonia", price: 3.0, diet:["vegano"] },
                { name: "Crostatina marmellata", price: 1.5, diet:["vegetariano"] },
                { name: "Lingue di gatto (1pz)", price: 1.0, diet:["vegetariano"] },
                { name: "Ferretti glassati (1pz)", price: 2.0, diet:["vegetariano"] }
            ],
            "Personalizzati": [
                { name: "Pizza Ripiena (Pizza classica)", price: 3.5, diet:["carne/pesce", "vegetariano", "vegano"] },
                { name: "Pizza Ripiena (Pizza classica) personalizzato", price: 3.5, diet:["carne/pesce", "vegetariano", "vegano"] },
                { name: "Pizza classica personalizzato", price: 3.5, diet:["carne/pesce", "vegetariano", "vegano"] },
                { name: "Ciabattina personalizzato", price: 3.5, diet:["carne/pesce", "vegetariano", "vegano"] },
                { name: "Pane Classico personalizzato", price: 3.5, diet:["carne/pesce", "vegetariano", "vegano"] },
                { name: "Focaccia personalizzato", price: 3.5, diet:["carne/pesce", "vegetariano", "vegano"] }
            ],
            "Menù Combinati": [
                { name: "Panino + acqua 50 cl", price: 4.0, diet: ["carne/pesce", "vegetariano", "vegano"] },
                { name: "Panino + lattina 33 cl", price: 4.5, diet: ["carne/pesce", "vegetariano", "vegano"] },
                { name: "Panino + bevanda 50 cl", price: 5.0, diet: ["carne/pesce", "vegetariano", "vegano"] },
                { name: "Menù (Speck Brie e pomodori secchi + Acqua naturale 50cl)", price: 4.0, diet: ["carne/pesce"] },
                { name: "Menù (Crudo pomodoro mozzarella + Acqua frizzante 50cl)", price: 4.0, diet: ["carne/pesce"] },
                { name: "Menù (Crudo pomodoro mozzarella + Coca Cola 33cl)", price: 4.5, diet: ["carne/pesce"] },
                { name: "Menù (Porchetta + Coca Cola 33cl)", price: 4.5, diet: ["carne/pesce"] },
                { name: "Menù (Porchetta + Coca Cola)", price: 4.5, diet: ["carne/pesce"] },
                { name: "Menù (Cotto arrosto scamorza e verdura + Coca Cola)", price: 4.5, diet: ["carne/pesce"] }
            ]
        };

        const state = {
            user: JSON.parse(localStorage.getItem('dose_user')) || null,
            cart: [], currentView: 'menu', search: '', cat: 'all', diet: 'all', posate: false,
            custom: { base: null, subtype: null, ings: [], total: 3.5 },
            ordersToday: [], menuData: [], menuExtras: [], menuOverrides: new Map(), disabledProducts: new Set(),
            frige: { products: [], purchasesToday: [], refillsToday: [], selected: null, filter: 'all', paymentFilter: 'pending' },
            customCreations: [],
            customFilter: 'all',
            ordersPaymentFilter: 'pending',
            ordersTimeFilter: 'all',
            ordersSelected: {},
            menuAudit: [],
            menuAuditFilter: 'all',
            pendingOrder: null,
            e2eNavDone: false,
            analytics: { ordersAll: [], frigeAll: [], frigeProducts: [], refillsOpen: [], unsub: {}, range: 'today', lastPreset: 'today', resolution: { orders: 'daily', frige: 'daily' }, targets: { orders: { min: null, max: null }, frige: { min: null, max: null } }, chartData: {}, zoom: { orders: null, frige: null } },
            subs: { orders: null, frige: null, menu: null, myOrders: null, custom: null, menuAudit: null },
            role: 'user',
            menuAdminOpen: (() => {
                try { return JSON.parse(localStorage.getItem('menu_admin_open') || 'true'); } catch(e) { return true; }
            })()
        };
        const LOW_STOCK_THRESHOLD = 2;
        const ORDER_CUTOFF = { hour: 11, minute: 30 };
        const isLocalE2E = (() => {
            try {
                const host = window.location.hostname;
                const params = new URLSearchParams(window.location.search);
                const flag = localStorage.getItem('dose_e2e');
                if(host === '127.0.0.1' || host === 'localhost') return true;
                return (params.get('e2e') === '1' || flag === '1');
            } catch(e) {
                return false;
            }
        })();

        const ROLE_EMAILS = {
            admin: ['marco.tranquilli@dos.design'],
            ristoratore: ['lorenzo.russo@alimentarirusso'],
            facility: ['beatrice.binini@dos.design', 'monica.porta@dos.design']
        };
        const ROLE_NAMES = {
            admin: ['marco tranquilli']
        };

        const firebaseConfig = { apiKey: "AIzaSyCQJsNbgaR89gF_1vLe6H4DPboOhQvm9nI", authDomain: "app-ordini-pranzo-alimentari.firebaseapp.com", projectId: "app-ordini-pranzo-alimentari", storageBucket: "app-ordini-pranzo-alimentari.appspot.com", messagingSenderId: "553169964686", appId: "1:553169964686:web:7f8ca6f32a301949e4c3df" };
        const app_fb = initializeApp(firebaseConfig);
        const auth_fb = getAuth(app_fb);
        const db_fb = initializeFirestore(app_fb, { experimentalForceLongPolling: true, localCache: persistentLocalCache() });
        const ordersCol = collection(db_fb, "orders");
        const ordersAuditCol = collection(db_fb, "orders_audit");
        const frigeProductsCol = collection(db_fb, "frige_products");
        const frigePurchasesCol = collection(db_fb, "frige_purchases");
        const frigeRefillsCol = collection(db_fb, "frige_refills");
        const menuProductsCol = collection(db_fb, "menu_products");
        const customCreationsCol = collection(db_fb, "custom_creations");
        const menuAuditCol = collection(db_fb, "menu_audit");

        // --- GLOBAL WINDOW FUNCTIONS ---
        window.onerror = (message, source, lineno, colno) => {
            try { window.toast(`Errore: ${message} (${lineno}:${colno})`); } catch(e) {}
        };
        const esc = (v) => String(v ?? '').replace(/[&<>"'`=\\/]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#x60;','=':'&#x3D;','/':'&#x2F;','\\':'&#x5C;'}[c]));
        const formatCurrency = (value) => `€${Number(value || 0).toFixed(2)}`;

        window.toast = (m) => {
            const el = document.getElementById('toast');
            document.getElementById('toast-message').textContent = m;
            el.classList.add('toast-show');
            setTimeout(() => { el.classList.remove('toast-show'); }, 2000);
        };

        const normalizeCat = (cat) => (cat || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const computeProductKey = (item) => `${normalizeCat(item.cat)}::${(item.name || '').toString().trim().toLowerCase()}`;
        const buildMenuList = () => {
            const base = state.menuData.map(i => ({ ...i, _key: computeProductKey(i) }));
            const baseKeys = new Set(base.map(i => i._key));
            const extras = state.menuExtras.map(i => ({ ...i, _key: computeProductKey(i) }));
            const merged = base.map(i => {
                const o = state.menuOverrides.get(i._key);
                return o ? { ...i, ...o, _key: i._key } : i;
            });
            const mergedExtras = extras.filter(i => !baseKeys.has(i._key)).map(i => {
                const o = state.menuOverrides.get(i._key);
                return o ? { ...i, ...o, _key: i._key } : i;
            });
            return merged.concat(mergedExtras);
        };

        const loadDisabledProducts = () => {
            // fallback cache for offline visibility
            try {
                const raw = JSON.parse(localStorage.getItem('dose_disabled_products') || '[]');
                state.disabledProducts = new Set(Array.isArray(raw) ? raw : []);
            } catch(e) {
                state.disabledProducts = new Set();
            }
        };
        const saveDisabledProducts = () => {
            localStorage.setItem('dose_disabled_products', JSON.stringify(Array.from(state.disabledProducts)));
        };

        const isOrderWindowOpen = () => {
            if(isLocalE2E) return true;
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            return h < ORDER_CUTOFF.hour || (h === ORDER_CUTOFF.hour && m < ORDER_CUTOFF.minute);
        };

        const ensureOrderWindow = () => {
            if(isLocalE2E) return true;
            if(isOrderWindowOpen()) return true;
            window.toast("Ordini chiusi dopo le 11:30. Usa Frige.");
            return false;
        };

        window.navigate = (v) => {
            if(!isLocalE2E && v === 'history' && !(isAdmin() || isRistoratore())) {
                window.toast("Accesso non autorizzato");
                return;
            }
            if(!isLocalE2E && v === 'analytics' && !(isAdmin() || isRistoratore())) {
                window.toast("Accesso non autorizzato");
                return;
            }
            if(v === 'frige' && !(isAdmin() || isRistoratore() || isFacility())) {
                window.toast("Accesso non autorizzato");
                return;
            }
            if(!isLocalE2E && (v === 'menu' || v === 'custom' || v === 'cart') && !isOrderWindowOpen()) {
                window.toast("Ordini chiusi dopo le 11:30. Usa Frige.");
                if(isAdmin() || isRistoratore() || isFacility()) {
                    v = 'frige';
                }
            }
            state.currentView = v;
            document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
            document.getElementById(`${v}-view`).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === `btn-${v}`));
            if(v === 'cart') renderCart();
            if(v === 'history') syncOrders();
            if(v === 'cart' && (isAdmin() || isRistoratore())) syncOrders();
            if(v === 'cart' && state.user && !(isAdmin() || isRistoratore())) syncMyOrders();
            if(v === 'frige') syncFrige();
            if(v === 'analytics') syncAnalytics();
            if(v === 'menu') renderMenuAdmin();
        };

        window.addStdToCart = (id) => {
            if(!ensureOrderWindow()) return;
            if(state.disabledProducts.has(id)) return window.toast("Prodotto non disponibile");
            const item = buildMenuList().find(i => i.id === id);
            const select = document.querySelector(`select[data-pid="${id}"]`);
            const price = select ? parseFloat(select.value) : item.price;
            const det = select ? `Porz: ${select.options[select.selectedIndex].text.split('-')[0]}` : "";
            state.cart.push({ ...item, price, details: det, cartId: Date.now() });
            document.getElementById('cart-count').textContent = state.cart.length;
            window.toast("Aggiunto!");
        };

        window.selectBase = (b) => {
            state.custom.base = b; state.custom.ings = [];
            const subs = b === 'Panino' ? ['Pane arabo','Ciabattina','5 cereali','Integrale'] : ['Pizza classica'];
            document.getElementById('subtype-list').innerHTML = subs.map(s => `<button data-action="set-subtype" data-subtype="${esc(s)}" class="p-4 bg-gray-50 rounded-2xl border-2 border-transparent font-bold text-[10px] uppercase hover:border-primary transition-all">${esc(s)}</button>`).join('');
            document.getElementById('custom-subtype-container').classList.remove('hidden');
        };

        window.setSubtype = (s) => {
            state.custom.subtype = s;
            document.getElementById('custom-ingredients-container').classList.remove('hidden');
            renderCustomIngs(); updateCustomSummary();
        };

        window.addIng = (id) => {
            state.custom.ings.push(INGREDIENTS_DATA.find(i => i.id === id));
            renderCustomIngs(); updateCustomSummary();
        };

        window.removeIng = (idx) => {
            state.custom.ings.splice(idx, 1);
            renderCustomIngs(); updateCustomSummary();
        };

        window.addCustomToCart = () => {
            if(!ensureOrderWindow()) return;
            const c = state.custom;
            if(!c.subtype || c.ings.length === 0) return window.toast("Scegli gli ingredienti!");
            state.cart.push({ name: `${c.base} (${c.subtype})`, price: c.total, cat: 'Crea', details: c.ings.map(i=>i.name).join(', '), cartId: Date.now() });
            document.getElementById('cart-count').textContent = state.cart.length;
            const saveToggle = document.getElementById('custom-save-toggle');
            const customName = (document.getElementById('custom-name-input')?.value || '').trim();
            if(saveToggle?.checked && customName) {
                saveCustomCreation(customName);
            }
            state.custom = { base:null, subtype:null, ings:[], total:3.5 };
            document.getElementById('custom-subtype-container').classList.add('hidden');
            document.getElementById('custom-ingredients-container').classList.add('hidden');
            window.navigate('menu');
        };

        async function saveCustomCreation(name) {
            if(!state.user) return;
            const c = state.custom;
            const payload = {
                name,
                type: c.base,
                subtype: c.subtype,
                ingredients: c.ings.map(i => i.name),
                ownerEmail: state.user.email,
                ownerName: state.user.name,
                votes: 0,
                voters: {},
                createdAt: serverTimestamp()
            };
            try {
                await addDoc(customCreationsCol, payload);
                window.toast("Creato nello storico");
                const input = document.getElementById('custom-name-input');
                if(input) input.value = '';
            } catch(e) {
                console.warn('save custom creation failed', e);
                window.toast("Errore salvataggio creazione");
            }
        }

        window.toggleProductAvailability = async (id) => {
            if(!(isAdmin() || isRistoratore())) return;
            const item = buildMenuList().find(i => i.id === id);
            if(!item) return;
            const key = computeProductKey(item);
            const ref = doc(db_fb, "menu_products", key);
            const shouldDisable = !state.disabledProducts.has(id);
            try {
                await runTransaction(db_fb, async (tx) => {
                    const snap = await tx.get(ref);
                    if(!snap.exists()) {
                        tx.set(ref, {
                            key,
                            name: item.name,
                            cat: item.cat,
                            isActive: !shouldDisable,
                            updatedAt: serverTimestamp(),
                            updatedBy: state.user?.email || 'anon'
                        });
                    } else {
                        tx.update(ref, {
                            isActive: !shouldDisable,
                            updatedAt: serverTimestamp(),
                            updatedBy: state.user?.email || 'anon'
                        });
                    }
                });
                await logMenuAudit('availability', {
                    key,
                    name: item.name,
                    cat: item.cat,
                    isActive: !shouldDisable
                });
            } catch(e) {
                console.warn('toggle availability failed', e);
                window.toast("Errore salvataggio disponibilità");
                return;
            }
            if(shouldDisable) state.disabledProducts.add(id);
            else state.disabledProducts.delete(id);
            saveDisabledProducts();
            renderMenu();
        };

        window.upsertMenuProduct = async () => {
            if(!(isAdmin() || isRistoratore())) return;
            const name = (document.getElementById('menu-admin-name')?.value || '').trim();
            const cat = (document.getElementById('menu-admin-cat')?.value || '').trim();
            const priceVal = parseFloat(document.getElementById('menu-admin-price')?.value || '');
            const diet = [];
            if(document.getElementById('menu-diet-meat')?.checked) diet.push('carne/pesce');
            if(document.getElementById('menu-diet-veg')?.checked) diet.push('vegetariano');
            if(document.getElementById('menu-diet-vegan')?.checked) diet.push('vegano');
            if(!name || !cat || Number.isNaN(priceVal)) return window.toast("Compila nome, categoria e prezzo");
            const item = { name, cat, price: priceVal, diet, isActive: true };
            const key = computeProductKey(item);
            try {
                let existed = false;
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "menu_products", key);
                    const snap = await tx.get(ref);
                    existed = snap.exists();
                    const payload = {
                        key,
                        name,
                        cat,
                        price: priceVal,
                        diet,
                        isActive: snap.exists() ? (snap.data().isActive !== false) : true,
                        updatedAt: serverTimestamp(),
                        updatedBy: state.user?.email || 'anon'
                    };
                    if(!snap.exists()) payload.createdAt = serverTimestamp();
                    tx.set(ref, payload, { merge: true });
                });
                await logMenuAudit(existed ? 'update' : 'create', {
                    key,
                    name,
                    cat,
                    price: priceVal,
                    diet
                });
                window.toast("Prodotto salvato");
                document.getElementById('menu-admin-name').value = '';
                document.getElementById('menu-admin-price').value = '';
            } catch(e) {
                console.warn('menu upsert failed', e);
                window.toast("Errore salvataggio prodotto");
            }
        };

        window.updateMenuPrice = async (key) => {
            if(!(isAdmin() || isRistoratore())) return;
            const input = document.querySelector(`input[data-price-key="${key}"]`);
            if(!input) return;
            const priceVal = parseFloat(input.value || '');
            if(Number.isNaN(priceVal)) return window.toast("Prezzo non valido");
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "menu_products", key);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) return;
                    tx.update(ref, { price: priceVal, updatedAt: serverTimestamp(), updatedBy: state.user?.email || 'anon' });
                });
                await logMenuAudit('price', { key, price: priceVal });
                window.toast("Prezzo aggiornato");
            } catch(e) {
                console.warn('update price failed', e);
                window.toast("Errore aggiornamento prezzo");
            }
        };

        async function logMenuAudit(action, payload = {}) {
            try {
                await addDoc(menuAuditCol, {
                    action,
                    payload,
                    actorEmail: state.user?.email || 'anon',
                    actorRole: state.role || 'user',
                    createdAt: serverTimestamp()
                });
            } catch(e) {
                console.warn('menu audit log failed', e);
            }
        }

        const renderMenuAdminToggle = () => {
            const quick = document.getElementById('role-quick');
            const txt = document.getElementById('role-quick-text');
            const hint = document.getElementById('role-quick-hint');
            const btn = document.getElementById('menu-admin-toggle');
            if(!quick || !txt || !hint || !btn) return;

            const cached = (() => {
                try { return JSON.parse(localStorage.getItem('dose_user') || 'null'); } catch(e) { return null; }
            })();
            const email = state.user?.email || cached?.email || '-';
            const role = state.user ? state.role : 'non autenticato';
            txt.textContent = `${email} · ${role}`;

            if(state.user) {
                quick.classList.remove('hidden');
                if(isAdmin() || isRistoratore()) {
                    btn.classList.remove('hidden');
                    btn.textContent = state.menuAdminOpen ? 'Nascondi gestione menù' : 'Mostra gestione menù';
                    hint.textContent = 'Accesso avanzato attivo: puoi gestire prodotti e disponibilità.';
                } else {
                    btn.classList.add('hidden');
                    hint.textContent = 'Accesso standard: alcune funzioni sono riservate.';
                }
            } else {
                quick.classList.add('hidden');
            }
        };

        window.toggleMenuAdmin = () => {
            state.menuAdminOpen = !state.menuAdminOpen;
            localStorage.setItem('menu_admin_open', JSON.stringify(state.menuAdminOpen));
            renderMenuAdmin();
            renderMenuAdminToggle();
        };

        window.renderMenuAdmin = () => {
            const panel = document.getElementById('menu-admin-panel');
            const list = document.getElementById('menu-admin-list');
            if(!panel || !list) return;
            if(!(isAdmin() || isRistoratore())) { panel.classList.add('hidden'); return; }
            if(!state.menuAdminOpen) { panel.classList.add('hidden'); return; }
            panel.classList.remove('hidden');
            const items = buildMenuList();
            list.innerHTML = items.map(i => {
                const key = computeProductKey(i);
                const active = !state.disabledProducts.has(i.id);
                return `
                    <div class="flex flex-wrap items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <div class="flex-1 min-w-[220px]">
                            <p class="font-bold text-sm">${esc(i.name)}</p>
                            <p class="text-[10px] text-gray-500">${esc(i.cat)}</p>
                        </div>
                        <input data-price-key="${key}" type="number" step="0.1" min="0" value="${i.price ?? ''}" class="p-2 rounded-xl border border-gray-200 text-[10px] font-bold w-24">
                        <button data-action="menu-update-price" data-key="${key}" class="btn btn-ghost text-[10px] px-3 py-2">Salva prezzo</button>
                        <button data-action="toggle-availability" data-id="${i.id}" class="btn btn-ghost text-[10px] px-3 py-2">${active ? 'Disattiva' : 'Riattiva'}</button>
                    </div>
                `;
            }).join('');
        };

        window.removeFromCart = (id) => {
            state.cart = state.cart.filter(i => i.cartId !== id);
            document.getElementById('cart-count').textContent = state.cart.length;
            renderCart();
        };

        window.togglePosate = () => {
            state.posate = !state.posate;
            const b = document.getElementById('posate-btn');
            b.textContent = state.posate ? 'Si' : 'No';
            b.classList.toggle('bg-primary', state.posate);
            b.classList.toggle('text-white', state.posate);
        };

        const normalizeEmail = (email) => (email || '').trim().toLowerCase();
        const normalizeName = (name) => (name || '').trim().toLowerCase();

        window.saveUserData = async () => {
            if(!auth_fb.currentUser) {
                window.toast("Accedi con Google per continuare");
                return;
            }
            const name = normalizeName(auth_fb.currentUser.displayName || document.getElementById('user-name-input').value);
            const email = normalizeEmail(auth_fb.currentUser.email || document.getElementById('user-email-input').value);
            if(name && email) {
                state.user = { name, email };
                localStorage.setItem('dose_user', JSON.stringify(state.user));
                document.getElementById('user-modal').classList.add('hidden');
                await setRole(email);
            }
        };

        window.signInWithGoogle = async () => {
            try {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth_fb, provider);
            } catch(e) {
                console.warn('Google sign-in failed', e);
                window.toast("Accesso Google non riuscito");
            }
        };

        window.signOutUser = async () => {
            try {
                await signOut(auth_fb);
                state.user = null;
                localStorage.removeItem('dose_user');
                document.getElementById('user-modal').classList.remove('hidden');
            } catch(e) {
                console.warn('sign out failed', e);
            }
        };

        window.refreshClaims = async () => {
            try {
                await auth_fb.currentUser?.getIdToken?.(true);
                await setRole(state.user?.email || '');
                window.toast("Ruoli aggiornati");
            } catch(e) {
                window.toast("Errore aggiornamento ruoli");
            }
        };

        window.sendOrder = async () => {
            if(!state.user) return document.getElementById('user-modal').classList.remove('hidden');
            if(!ensureOrderWindow()) return;
            if(!state.cart.length) return window.toast("Carrello vuoto");
            const total = state.cart.reduce((s,i)=>s+i.price, 0);
            if(total <= 0) return window.toast("Totale non valido");
            openSendConfirm({
                items: state.cart.slice(),
                total,
                allergies: document.getElementById('allergies-input').value,
                posate: state.posate ? 'Si' : 'No'
            });
        };

        function buildOrderConfirmSummary(orderId, items, total) {
            const lines = items.map(i => `• ${i.name}${i.details ? ` (${i.details})` : ''} — ${formatCurrency(i.price)}`);
            return `Ordine #${orderId}\n` + lines.join('\n') + `\nTotale: ${formatCurrency(total)}`;
        }

        function buildSendSummaryHtml(items) {
            return items.map(i => {
                const label = `${esc(i.name)}${i.details ? ` (${esc(i.details)})` : ''}`;
                return `<div class="flex items-center justify-between gap-2">
                    <span>${label}</span>
                    <span class="text-primary font-black">${formatCurrency(i.price)}</span>
                </div>`;
            }).join('');
        }

        function openSendConfirm(payload) {
            state.pendingOrder = payload;
            const modal = document.getElementById('order-send-modal');
            const box = document.getElementById('order-send-summary');
            const totalEl = document.getElementById('order-send-total');
            const countEl = document.getElementById('order-send-count');
            const notesEl = document.getElementById('order-send-notes');
            const check = document.getElementById('order-send-check');
            const submit = document.getElementById('order-send-submit');
            if(!modal || !box || !check || !submit) return;
            if(isLocalE2E) {
                state.pendingOrder = null;
                state.cart = [];
                const cartCount = document.getElementById('cart-count');
                if(cartCount) cartCount.textContent = '0';
                window.toast("Inviato!");
                return;
            }
            box.innerHTML = buildSendSummaryHtml(payload.items);
            if(totalEl) totalEl.textContent = formatCurrency(payload.total);
            if(countEl) countEl.textContent = `${payload.items.length} prodotti`;
            if(notesEl) {
                const notes = [];
                if(payload.allergies && payload.allergies.trim().length > 0) notes.push(`Note: ${esc(payload.allergies.trim())}`);
                notesEl.innerHTML = notes.length ? notes.map(n => `<div>${n}</div>`).join('') : '';
            }
            check.checked = false;
            submit.disabled = true;
            modal.classList.remove('hidden');
        }

        function closeSendConfirm() {
            const modal = document.getElementById('order-send-modal');
            if(modal) modal.classList.add('hidden');
            state.pendingOrder = null;
        }

        async function confirmSendOrder() {
            if(!state.pendingOrder) return;
            const check = document.getElementById('order-send-check');
            if(check && !check.checked) return window.toast("Conferma l'invio");
            const payload = state.pendingOrder;
            try {
                const docRef = await addDoc(ordersCol, { 
                    user: state.user.name, email: state.user.email,
                    uid: auth_fb.currentUser.uid,
                    items: payload.items, total: payload.total, 
                    allergies: payload.allergies,
                    posate: payload.posate,
                    paymentStatus: "pending",
                    reconciled: false,
                    orderStatus: "submitted",
                    orderType: "order",
                    createdAt: serverTimestamp() 
                });
                closeSendConfirm();
                const summary = buildOrderConfirmSummary(docRef.id, payload.items, payload.total);
                showOrderConfirm(summary);
                state.pendingOrder = null;
                state.cart = []; document.getElementById('cart-count').textContent='0'; window.navigate('history'); window.toast("Inviato!");
            } catch(e) { alert("Connessione fallita. Carica online!"); }
        }

        function showOrderConfirm(summaryText) {
            const modal = document.getElementById('order-confirm-modal');
            const box = document.getElementById('order-confirm-summary');
            box.textContent = summaryText;
            modal.classList.remove('hidden');
            modal.dataset.summary = summaryText;
        }

        function closeOrderConfirm() {
            const modal = document.getElementById('order-confirm-modal');
            modal.classList.add('hidden');
        }

        function copyOrderConfirm() {
            const modal = document.getElementById('order-confirm-modal');
            const summary = modal.dataset.summary || '';
            if(!summary) return;
            navigator.clipboard.writeText(summary).then(() => window.toast("Riepilogo copiato"));
        }

        // --- FUNZIONE RIEPILOGO AGGIORNATA ---
        window.copyDailySummary = () => {
            if(state.ordersToday.length === 0) return window.toast("Nessun ordine presente!");

            const chronOrder = [...state.ordersToday].reverse();
            const dateLabel = new Date().toLocaleDateString('it-IT');
            const totalOrders = chronOrder.length;
            const totalAmount = chronOrder.reduce((s, o) => s + (o.total || 0), 0);

            let text = `📋 *ORDINI DOSEPRANZA — ${dateLabel}*\n`;
            text += `Totale ordini: ${totalOrders} · Totale: ${formatCurrency(totalAmount)}\n`;
            text += `────────────────────\n\n`;

            chronOrder.forEach((o, idx) => {
                const time = o.createdAt ? o.createdAt.toDate() : null;
                const hh = time ? String(time.getHours()).padStart(2, '0') : '--';
                const mm = time ? String(time.getMinutes()).padStart(2, '0') : '--';
                const orderTotal = formatCurrency(o.total || 0);

                text += `${idx + 1}) *${o.user.toUpperCase()}* (${hh}:${mm}) — Totale ${orderTotal}\n`;
                o.items.forEach((i) => {
                    text += `• ${i.name}`;
                    if(i.details && i.details !== "") text += ` (${i.details})`;
                    text += `\n`;
                });
                text += `Da pagare: ${orderTotal}\n`;
                if(o.allergies && o.allergies.trim().length > 0) {
                    text += `⚠️ Note: ${o.allergies.trim()}\n`;
                }
                text += `\n`;
            });

            navigator.clipboard.writeText(text.trim()).then(() => window.toast("Copiato per WhatsApp!"));
        };

        window.copyKitchenSummary = () => {
            if(state.ordersToday.length === 0) return window.toast("Nessun ordine presente!");
            const { itemsSorted, totalOrders, totalItems } = buildKitchenSummary();
            const dateLabel = new Date().toLocaleDateString('it-IT');
            let text = `👨‍🍳 *COMANDA CUCINA — ${dateLabel}*\n`;
            text += `Ordini: ${totalOrders} · Pezzi totali: ${totalItems}\n`;
            text += `────────────────────\n`;
            itemsSorted.forEach(({ label, count }) => {
                text += `• ${label} × ${count}\n`;
            });
            navigator.clipboard.writeText(text.trim()).then(() => window.toast("Copiato per Cucina!"));
        };

        window.exportFullHistory = async () => {
            const snap = await getDocs(query(ordersCol, orderBy("createdAt", "desc")));
            const fmt = (n) => {
                if(n === null || n === undefined || n === '') return '';
                const num = Number(n);
                if(Number.isNaN(num)) return '';
                return num.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            };
            let csv = "OrderID;TimestampISO8601;DataLeggibile;UserID;Utente;EmailUtente;Prodotto;Dettagli;CategoriaProdotto;Quantita;PrezzoUnitario;TotaleRiga;MetodoPagamento;Allergie;Posate;CanaleOrdine;StatoPagamento;RispostaRistoratore\n";
            snap.forEach(d => {
                const o = d.data();
                if(!isValidOrder(o)) return;
                const ts = o.createdAt?.toDate();
                o.items.forEach(i => {
                    const status = o.paymentStatus === "paid" ? "Pagato" : "Da Pagare";
                    csv += `${d.id};${ts ? ts.toISOString() : ''};${ts ? ts.toLocaleString() : ''};${o.uid || ''};${o.user || ''};${o.email || ''};${i.name || ''};${i.details || ''};${i.cat || ''};1;${fmt(i.price)};${fmt(i.price)};Satispay;${o.allergies || "No"};${o.posate || "No"};Web;${status};${o.ristoratoreResponse || ''}\n`;
                });
            });
            const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Storico_Ordini.csv"; link.click();
        };

        // --- FRIGE MVP ---
        window.openFrigeModal = (id) => {
            if(!state.user) return document.getElementById('user-modal').classList.remove('hidden');
            const p = state.frige.products.find(x => x.id === id);
            if(!p) return;
            state.frige.selected = p;
            document.getElementById('frige-modal-product').textContent = p.name;
            document.getElementById('frige-modal-price').textContent = `€${p.price.toFixed(2)}`;
            document.getElementById('frige-paid-check').checked = false;
            document.getElementById('frige-confirm-btn').disabled = true;
            document.getElementById('frige-modal').classList.remove('hidden');
        };

        window.closeFrigeModal = () => {
            document.getElementById('frige-modal').classList.add('hidden');
        };

        const paidCheckEl = document.getElementById('frige-paid-check');
        if(paidCheckEl) {
            paidCheckEl.addEventListener('change', (e) => {
                const btn = document.getElementById('frige-confirm-btn');
                if(btn) btn.disabled = !e.target.checked;
            });
        }

        const sendCheckEl = document.getElementById('order-send-check');
        if(sendCheckEl) {
            sendCheckEl.addEventListener('change', (e) => {
                const btn = document.getElementById('order-send-submit');
                if(btn) btn.disabled = !e.target.checked;
            });
        }

        window.confirmFrigePurchase = async () => {
            const p = state.frige.selected;
            if(!p) return;
            if(!document.getElementById('frige-paid-check').checked) return window.toast("Conferma il pagamento");

            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "frige_products", p.id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Prodotto non trovato");
                    const data = snap.data();
                    const stock = data.stock ?? 0;
                    if(stock <= 0) throw new Error("Prodotto esaurito");
                    tx.update(ref, { stock: stock - 1, updatedAt: serverTimestamp() });
                    const purchaseRef = doc(frigePurchasesCol);
                    tx.set(purchaseRef, {
                        productId: p.id,
                        productName: data.name,
                        price: data.price,
                        quantity: 1,
                        total: data.price,
                        user: state.user.name,
                        email: state.user.email,
                        uid: auth_fb.currentUser.uid,
                        paidConfirmed: true,
                        paymentStatus: "pending",
                        reconciled: false,
                        createdAt: serverTimestamp()
                    });
                });
                window.closeFrigeModal();
                window.toast("Acquisto registrato!");
            } catch(e) {
                window.toast(e.message || "Errore acquisto");
            }
        };

        window.seedFrigeProducts = async () => {
            if(!isAdmin()) return;
            try {
                const existing = await getDocs(query(frigeProductsCol, orderBy("name", "asc")));
                if(!existing.empty) return window.toast("Prodotti gia presenti");
                for(const p of FRIGE_DEFAULTS) {
                    await addDoc(frigeProductsCol, { ...p, active: true, createdAt: serverTimestamp() });
                }
                window.toast("Prodotti inizializzati");
            } catch(e) {
                window.toast("Errore inizializzazione");
            }
        };

        window.adjustFrigeStock = async (id, delta) => {
            if(!isFacility() && !isAdmin()) return;
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "frige_products", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Prodotto non trovato");
                    const data = snap.data();
                    const stock = Math.max(0, (data.stock ?? 0) + delta);
                    tx.update(ref, { stock, updatedAt: serverTimestamp() });
                });
            } catch(e) {
                window.toast("Errore stock");
            }
        };

        window.addFrigeProductFromForm = async () => {
            if(!isRistoratore() && !isAdmin()) return;
            const name = document.getElementById('frige-new-name').value.trim();
            const price = parseFloat(document.getElementById('frige-new-price').value);
            const stock = Math.max(0, parseInt(document.getElementById('frige-new-stock').value || "0", 10));
            if(!name || Number.isNaN(price)) return window.toast("Compila nome e prezzo");
            try {
                await addDoc(frigeProductsCol, { name, price, stock, active: true, createdAt: serverTimestamp() });
                document.getElementById('frige-new-name').value = "";
                document.getElementById('frige-new-price').value = "";
                document.getElementById('frige-new-stock').value = "";
                window.toast("Prodotto aggiunto");
            } catch(e) {
                window.toast("Errore aggiunta");
            }
        };

        window.applyFrigeRestock = async () => {
            if(!isFacility() && !isAdmin()) return;
            const id = document.getElementById('frige-restock-product').value;
            const qty = parseInt(document.getElementById('frige-restock-qty').value || "0", 10);
            if(!id || !qty) return window.toast("Seleziona prodotto e quantita");
            await window.adjustFrigeStock(id, qty);
            document.getElementById('frige-restock-qty').value = "";
        };

        window.addFrigeProduct = async () => {
            if(!isRistoratore() && !isAdmin()) return;
            const name = prompt("Nome prodotto");
            if(!name) return;
            const priceRaw = prompt("Prezzo (es. 4.50)");
            const price = parseFloat(priceRaw);
            if(Number.isNaN(price)) return window.toast("Prezzo non valido");
            const stockRaw = prompt("Quantita iniziale (numero)");
            const stock = Math.max(0, parseInt(stockRaw || "0", 10));
            try {
                await addDoc(frigeProductsCol, { name, price, stock, active: true, createdAt: serverTimestamp() });
                window.toast("Prodotto aggiunto");
            } catch(e) {
                window.toast("Errore aggiunta");
            }
        };

        window.updateFrigePrice = async (id, currentPrice) => {
            if(!isRistoratore() && !isAdmin()) return;
            const priceRaw = prompt("Nuovo prezzo", (currentPrice ?? 0).toString());
            const price = parseFloat(priceRaw);
            if(Number.isNaN(price)) return window.toast("Prezzo non valido");
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "frige_products", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Prodotto non trovato");
                    tx.update(ref, { price, updatedAt: serverTimestamp() });
                });
                window.toast("Prezzo aggiornato");
            } catch(e) {
                window.toast("Errore prezzo");
            }
        };

        window.toggleFrigeActive = async (id, activeNow) => {
            if(!isRistoratore() && !isAdmin()) return;
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "frige_products", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Prodotto non trovato");
                    tx.update(ref, { active: !activeNow, updatedAt: serverTimestamp() });
                });
                window.toast(activeNow ? "Prodotto rimosso" : "Prodotto riattivato");
            } catch(e) {
                window.toast("Errore aggiornamento");
            }
        };

        window.requestFrigeRefill = async (id) => {
            if(!isFacility()) return;
            const p = state.frige.products.find(x => x.id === id);
            if(!p) return;
            try {
                await addDoc(frigeRefillsCol, {
                    productId: p.id,
                    productName: p.name,
                    requestedBy: state.user?.name || "Facility",
                    status: "open",
                    createdAt: serverTimestamp()
                });
                window.toast("Rifornimento richiesto");
            } catch(e) {
                window.toast("Errore richiesta");
            }
        };

        window.closeFrigeRefill = async (id) => {
            if(!isRistoratore() && !isAdmin()) return;
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "frige_refills", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Richiesta non trovata");
                    tx.update(ref, { status: "closed", closedAt: serverTimestamp() });
                });
                window.toast("Richiesta evasa");
            } catch(e) {
                window.toast("Errore chiusura");
            }
        };

        window.setFrigeFilter = (filter) => {
            state.frige.filter = filter;
            const allBtn = document.getElementById('frige-filter-all');
            const lowBtn = document.getElementById('frige-filter-low');
            const outBtn = document.getElementById('frige-filter-out');
            [allBtn, lowBtn, outBtn].forEach(b => b.classList.remove('bg-primary','text-white'));
            [allBtn, lowBtn, outBtn].forEach(b => b.classList.add('bg-gray-100','text-gray-700'));
            if(filter === 'all') { allBtn.classList.remove('bg-gray-100','text-gray-700'); allBtn.classList.add('bg-primary','text-white'); }
            if(filter === 'low') { lowBtn.classList.remove('bg-gray-100','text-gray-700'); lowBtn.classList.add('bg-primary','text-white'); }
            if(filter === 'out') { outBtn.classList.remove('bg-gray-100','text-gray-700'); outBtn.classList.add('bg-primary','text-white'); }
            renderFrigeProducts();
        };

        window.setFrigePaymentFilter = (filter) => {
            state.frige.paymentFilter = filter;
            const pendingBtn = document.getElementById('frige-pay-filter-pending');
            const paidBtn = document.getElementById('frige-pay-filter-paid');
            [pendingBtn, paidBtn].forEach(b => b.classList.remove('bg-primary','text-white'));
            [pendingBtn, paidBtn].forEach(b => b.classList.add('bg-gray-100','text-gray-700'));
            if(filter === 'pending') { pendingBtn.classList.remove('bg-gray-100','text-gray-700'); pendingBtn.classList.add('bg-primary','text-white'); }
            if(filter === 'paid') { paidBtn.classList.remove('bg-gray-100','text-gray-700'); paidBtn.classList.add('bg-primary','text-white'); }
            renderFrigePayments();
        };

        window.markFrigePayment = async (id, nextStatus) => {
            if(!isRistoratore() && !isAdmin()) return;
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "frige_purchases", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Acquisto non trovato");
                    tx.update(ref, {
                        paymentStatus: nextStatus,
                        reconciled: nextStatus === "paid",
                        reconciledAt: nextStatus === "paid" ? serverTimestamp() : null,
                        reconciledBy: state.user?.email || "ristoratore"
                    });
                });
                window.toast(nextStatus === "paid" ? "Riconciliato" : "Segnato non riconciliato");
            } catch(e) {
                window.toast("Errore riconciliazione");
            }
        };

        window.copyFrigePayments = () => {
            if(!isRistoratore() && !isAdmin()) return;
            const list = state.frige.purchasesToday
                .filter(p => state.frige.paymentFilter === "paid" ? p.paymentStatus === "paid" : p.paymentStatus !== "paid");
            if(list.length === 0) return window.toast("Nessun dato");
            let text = `🧾 *FRIGE PAGAMENTI - ${new Date().toLocaleDateString('it-IT')}*\\n\\n`;
            list.forEach(p => {
                const t = p.createdAt ? p.createdAt.toDate() : null;
                const time = t ? `${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()}` : '';
                text += `👤 ${p.user} ${time ? '(' + time + ')' : ''}\\n`;
                text += `▪️ ${p.productName} - €${(p.price || 0).toFixed(2)}\\n`;
                text += `Stato: ${p.paymentStatus === "paid" ? "Riconciliato" : "Da verificare"}\\n`;
                text += `-------------------\\n`;
            });
            navigator.clipboard.writeText(text).then(() => window.toast("Lista copiata"));
        };

        window.setOrdersPaymentFilter = (filter) => {
            state.ordersPaymentFilter = filter;
            const pendingBtn = document.getElementById('orders-pay-filter-pending');
            const paidBtn = document.getElementById('orders-pay-filter-paid');
            [pendingBtn, paidBtn].forEach(b => b.classList.remove('bg-primary','text-white'));
            [pendingBtn, paidBtn].forEach(b => b.classList.add('bg-gray-100','text-gray-700'));
            if(filter === 'pending') { pendingBtn.classList.remove('bg-gray-100','text-gray-700'); pendingBtn.classList.add('bg-primary','text-white'); }
            if(filter === 'paid') { paidBtn.classList.remove('bg-gray-100','text-gray-700'); paidBtn.classList.add('bg-primary','text-white'); }
            renderOrdersPayments();
        };

        window.markOrderPayment = async (id, nextStatus) => {
            if(!isRistoratore() && !isAdmin()) return;
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "orders", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Ordine non trovato");
                    tx.update(ref, {
                        paymentStatus: nextStatus,
                        reconciled: nextStatus === "paid",
                        reconciledAt: nextStatus === "paid" ? serverTimestamp() : null,
                        reconciledBy: state.user?.email || "ristoratore"
                    });
                });
                await logOrderAudit(id, "payment_status", { paymentStatus: nextStatus });
                window.toast(nextStatus === "paid" ? "Riconciliato" : "Segnato non riconciliato");
            } catch(e) {
                window.toast("Errore riconciliazione");
            }
        };

        window.setOrderStatus = async (id, status) => {
            if(!isRistoratore() && !isAdmin()) return;
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "orders", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) throw new Error("Ordine non trovato");
                    tx.update(ref, {
                        orderStatus: status,
                        statusUpdatedAt: serverTimestamp(),
                        statusUpdatedBy: state.user?.email || "ristoratore"
                    });
                });
                await logOrderAudit(id, "order_status", { orderStatus: status });
                window.toast("Stato aggiornato");
            } catch(e) {
                window.toast("Errore stato");
            }
        };

        window.copyOrdersPayments = () => {
            if(!isRistoratore() && !isAdmin()) return;
            const list = getFilteredOrdersForReconciliation();
            if(list.length === 0) return window.toast("Nessun dato");
            let text = `🧾 *ORDINI PAGAMENTI - ${new Date().toLocaleDateString('it-IT')}*\\n\\n`;
            list.forEach(p => {
                const t = p.createdAt ? p.createdAt.toDate() : null;
                const time = t ? `${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()}` : '';
                text += `👤 ${p.user} ${time ? '(' + time + ')' : ''}\\n`;
                text += `▪️ Totale: €${(p.total || 0).toFixed(2)}\\n`;
                text += `Stato: ${p.paymentStatus === "paid" ? "Riconciliato" : "Da verificare"}\\n`;
                text += `-------------------\\n`;
            });
            navigator.clipboard.writeText(text).then(() => window.toast("Lista copiata"));
        };

        window.setOrdersTimeFilter = (filter) => {
            state.ordersTimeFilter = filter;
            const allBtn = document.getElementById('orders-time-filter-all');
            const preBtn = document.getElementById('orders-time-filter-pre');
            const postBtn = document.getElementById('orders-time-filter-post');
            [allBtn, preBtn, postBtn].forEach(b => b.classList.remove('bg-primary','text-white'));
            [allBtn, preBtn, postBtn].forEach(b => b.classList.add('bg-gray-100','text-gray-700'));
            if(filter === 'all') { allBtn.classList.remove('bg-gray-100','text-gray-700'); allBtn.classList.add('bg-primary','text-white'); }
            if(filter === 'pre1130') { preBtn.classList.remove('bg-gray-100','text-gray-700'); preBtn.classList.add('bg-primary','text-white'); }
            if(filter === 'post1130') { postBtn.classList.remove('bg-gray-100','text-gray-700'); postBtn.classList.add('bg-primary','text-white'); }
            renderOrdersPayments();
        };

        window.toggleSelectOrder = (id) => {
            state.ordersSelected[id] = !state.ordersSelected[id];
        };

        window.toggleSelectAllOrders = () => {
            const list = getFilteredOrdersForReconciliation();
            const allSelected = list.every(o => state.ordersSelected[o.id]);
            list.forEach(o => { state.ordersSelected[o.id] = !allSelected; });
            renderOrdersPayments();
        };

        window.reconcileSelectedOrders = async () => {
            if(!isRistoratore() && !isAdmin()) return;
            const ids = Object.entries(state.ordersSelected).filter(([,v]) => v).map(([k]) => k);
            if(ids.length === 0) return window.toast("Nessun ordine selezionato");
            try {
                for(const id of ids) {
                    await window.markOrderPayment(id, "paid");
                    state.ordersSelected[id] = false;
                }
            } catch(e) {
                window.toast("Errore riconciliazione");
            }
        };

        window.exportOrdersReconciliation = () => {
            if(!isRistoratore() && !isAdmin()) return;
            const list = getFilteredOrdersForReconciliation();
            if(list.length === 0) return window.toast("Nessun dato");
            let csv = "OrderID;TimestampISO8601;Utente;Email;Totale;StatoPagamento;RiconciliatoDa\\n";
            list.forEach(o => {
                const ts = o.createdAt?.toDate();
                csv += `${o.id};${ts ? ts.toISOString() : ''};${o.user};${o.email};${(o.total || 0).toFixed(2)};${o.paymentStatus || 'pending'};${o.reconciledBy || ''}\\n`;
            });
            const blob = new Blob([`\\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Riconciliazione_Ordini_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
        };

        window.cleanupInvalidOrders = async () => {
            if(!isRistoratore() && !isAdmin()) return;
            const invalid = (state.ordersRawToday || []).filter(o => !isValidOrder(o));
            if(invalid.length === 0) return window.toast("Nessun tentativo da pulire");
            const ok = window.confirm(`Vuoi rimuovere ${invalid.length} ordini non validi di oggi?`);
            if(!ok) return;
            try {
                const batch = writeBatch(db_fb);
                invalid.forEach(o => {
                    const ref = doc(db_fb, "orders", o.id);
                    batch.update(ref, {
                        orderStatus: "void",
                        voidedAt: serverTimestamp(),
                        voidedBy: state.user?.email || "system"
                    });
                });
                await batch.commit();
                window.toast("Tentativi rimossi");
            } catch(e) {
                console.warn(e);
                window.toast("Errore pulizia");
            }
        };

        async function autoVoidInvalidOrders() {
            if(!isAdmin() && !isRistoratore()) return;
            try {
                const key = 'dose_auto_void_ts';
                const last = parseInt(localStorage.getItem(key) || '0', 10);
                if(Date.now() - last < 15 * 60 * 1000) return; // max 1 volta ogni 15 min
                const invalid = (state.ordersRawToday || []).filter(shouldAutoVoidOrder);
                if(invalid.length === 0) return;
                const batch = writeBatch(db_fb);
                invalid.forEach(o => {
                    const ref = doc(db_fb, "orders", o.id);
                    batch.update(ref, {
                        orderStatus: "void",
                        voidedAt: serverTimestamp(),
                        voidedBy: state.user?.email || "auto-clean"
                    });
                });
                await batch.commit();
                localStorage.setItem(key, Date.now().toString());
            } catch(e) {
                console.warn('auto-void failed', e);
            }
        }

        window.copyFrigeSummary = () => {
            if(state.frige.purchasesToday.length === 0) return window.toast("Nessun acquisto");
            let text = `🧊 *FRIGE - ${new Date().toLocaleDateString('it-IT')}*\n\n`;
            const chron = [...state.frige.purchasesToday].reverse();
            chron.forEach(o => {
                const t = o.createdAt ? o.createdAt.toDate() : null;
                text += `👤 *${o.user}*`;
                if(t) text += ` (${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()})`;
                text += `\n`;
                text += `▪️ ${o.productName} - €${(o.price || 0).toFixed(2)}\n`;
                text += `-------------------\n`;
            });
            navigator.clipboard.writeText(text).then(() => window.toast("Copiato!"));
        };

        // --- INTERNAL LOGIC ---
        function renderMenu() {
            const orderOpen = isOrderWindowOpen();
            const filtered = buildMenuList().filter(i => {
                const s = i.name.toLowerCase().includes(state.search.toLowerCase());
                const c = state.cat === 'all' || i.cat === state.cat;
                const d = state.diet === 'all' || (i.diet && i.diet.includes(state.diet));
                return s && c && d;
            });
            let cur = "";
            document.getElementById('menu-container').innerHTML = filtered.map(i => {
                let html = "";
                if(i.cat !== cur) { cur = i.cat; html += `<div class="col-span-full mt-6 mb-2 font-black text-[10px] uppercase text-primary/60 border-b border-primary/10 tracking-widest">${esc(cur)}</div>`; }
                const pricing = i.hasPortions ? `<select data-pid="${i.id}" class="text-[9px] p-2 border rounded-xl w-full font-bold outline-none bg-gray-50">${i.portions.map(o=>`<option value="${o.v}">${esc(o.t)}</option>`).join('')}</select>` : `<span class="font-black text-primary text-lg">${formatCurrency(i.price)}</span>`;
                const isDisabled = state.disabledProducts.has(i.id);
                const disabled = (!orderOpen || isDisabled) ? 'opacity-50 pointer-events-none' : '';
                const canManage = isAdmin() || isRistoratore();
                const statusBadge = isDisabled ? `<span class="badge badge-red">Non disponibile</span>` : '';
                html += `<div class="card p-5 rounded-[2rem] flex flex-col justify-between ${disabled}">
                    <div class="flex items-start justify-between gap-2">
                        <div><h4 class="font-bold text-sm product-title leading-tight mb-1">${esc(i.name)}</h4><p class="text-[9px] text-gray-300 italic">${esc(i.cat)}</p></div>
                        ${statusBadge}
                    </div>
                    <div class="mt-4 flex justify-between items-center gap-2">${pricing}<button data-action="add-std" data-id="${i.id}" class="bg-primary text-white h-10 w-10 rounded-2xl shadow-lg flex items-center justify-center flex-shrink-0 active:scale-90" ${(!orderOpen || isDisabled) ? 'disabled' : ''}><i class="fas fa-plus"></i></button></div>
                    ${canManage ? `<button data-action="toggle-availability" data-id="${i.id}" class="mt-3 btn btn-ghost text-[10px] px-3 py-2">${isDisabled ? 'Riattiva' : 'Disattiva'}</button>` : ''}
                </div>`;
                return html;
            }).join('');
        }

        function renderCustomIngs() {
            document.getElementById('ingredients-grid').innerHTML = INGREDIENTS_DATA.map(ing => {
                const count = state.custom.ings.filter(i => i.id === ing.id).length;
                return `<div data-action="add-ing" data-id="${ing.id}" class="ingredient-card bg-white p-3 rounded-2xl border-2 border-transparent shadow-sm text-center cursor-pointer transition-all relative ${count > 0 ? 'selected border-primary' : ''}">
                    <p class="text-[9px] font-bold leading-tight">${esc(ing.name)}</p>
                    ${count > 0 ? `<span class="absolute -top-1 -right-1 bg-primary text-white text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-black shadow-md">${count}</span>` : ''}
                </div>`;
            }).join('');
        }

        function updateCustomSummary() {
            const s = state.custom;
            s.total = 3.5 + Math.max(0, s.ings.length - 3) * 1.0;
            document.getElementById('custom-price-display').textContent = formatCurrency(s.total);
            document.getElementById('custom-summary-list').innerHTML = s.ings.map((n, idx) => `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-xl mb-1 text-[9px]"><span>${esc(n.name)}</span><button data-action="remove-ing" data-index="${idx}" class="text-red-300"><i class="fas fa-times"></i></button></li>`).join('');
        }

        function renderCart() {
            const wrap = document.getElementById('cart-items-list');
            const opts = document.getElementById('cart-options');
            if(state.cart.length === 0) {
                wrap.innerHTML = `
                    <div class="flex flex-col items-center gap-3 py-12 text-center">
                        <i class="fas fa-shopping-basket text-3xl text-gray-200"></i>
                        <p class="text-gray-400 font-bold uppercase text-sm">Il tuo carrello è vuoto</p>
                        <button data-action="navigate" data-view="menu" class="text-primary font-black text-sm underline underline-offset-4">Vai al menù</button>
                    </div>
                `;
                opts.classList.add('hidden');
                renderMyOrderStatus();
                renderDailySummaryInline();
                return;
            }
            opts.classList.remove('hidden');
            const tot = state.cart.reduce((s,i) => s+i.price, 0);
            wrap.innerHTML = state.cart.map(i => `<div class="flex justify-between items-center py-4 border-b border-gray-50">
                <div class="min-w-0 pr-4 text-left"><p class="font-black text-sm text-gray-800">${esc(i.name)}</p><p class="text-[9px] text-gray-300 truncate">${esc(i.details || '')}</p><p class="text-xs text-primary font-black">${formatCurrency(i.price)}</p></div>
                <button data-action="remove-from-cart" data-id="${i.cartId}" class="text-red-300 p-2"><i class="fas fa-trash-alt"></i></button>
            </div>`).join('');
            document.getElementById('cart-total-display').textContent = formatCurrency(tot);
            renderMyOrderStatus();
            renderDailySummaryInline();
        }

        function syncMyOrders() {
            if(!state.user?.email || state.subs.myOrders) return;
            state.subs.myOrders = onSnapshot(
                query(ordersCol, where("email", "==", state.user.email), orderBy("createdAt", "desc")),
                snap => {
                    state.myOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    renderMyOrderStatus();
                },
                () => {
                    state.subs.myOrders = null;
                    onSnapshot(query(ordersCol, orderBy("createdAt", "desc")), snap => {
                        state.myOrders = snap.docs
                            .map(d => ({ id: d.id, ...d.data() }))
                            .filter(o => o.email === state.user.email);
                        renderMyOrderStatus();
                    });
                }
            );
        }

        function renderMyOrderStatus() {
            const el = document.getElementById('my-order-status');
            if(!el) return;
            if(!state.user) {
                el.innerHTML = `<div class="text-[11px] text-gray-500 font-bold">Accedi per vedere lo stato del tuo ordine.</div>`;
                return;
            }
            const orders = (state.myOrders || []).filter(isValidOrder);
            if(!orders.length) {
                el.innerHTML = `<div class="text-[11px] text-gray-500 font-bold">Nessun ordine inviato oggi.</div>`;
                return;
            }
            const latest = orders[0];
            const paid = latest.paymentStatus === "paid";
            const statusRaw = (latest.orderStatus || "submitted").toLowerCase();
            const statusMap = {
                submitted: "Inviato",
                ricevuto: "Inviato",
                accepted: "In preparazione",
                preparing: "In preparazione",
                completed: "Pronto",
                delivered: "Consegnato"
            };
            const status = statusMap[statusRaw] || statusRaw;
            const time = latest.createdAt ? formatTime(latest.createdAt) : '--:--';
            const items = (latest.items || []).map(i => `${i.name}${i.details ? ` (${i.details})` : ''}`).join(' • ');
            el.innerHTML = `
                <div class="bg-white p-4 rounded-2xl border border-gray-100">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-[10px] uppercase text-gray-400 font-black">Il tuo ultimo ordine</p>
                        <span class="badge ${paid ? 'badge-green' : 'badge-amber'}">${paid ? 'Pagato' : 'Da verificare'}</span>
                    </div>
                    <p class="text-[12px] font-black mb-1">${esc(items)}</p>
                    <div class="text-[11px] text-gray-500 font-bold">Ore ${time} · Stato: ${status}</div>
                </div>
            `;
        }

        const formatTime = (ts) => {
            if(!ts) return '--:--';
            const d = ts.toDate ? ts.toDate() : ts;
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        };

        function syncMenuAvailability() {
            if(state.subs.menu) return;
            state.subs.menu = onSnapshot(query(menuProductsCol, orderBy("name", "asc")), snap => {
                const disabled = new Set();
                const overrides = new Map();
                const extras = [];
                snap.docs.forEach(d => {
                    const data = d.data();
                    const key = data?.key || '';
                    if(key) overrides.set(key, data);
                    if(data && data.isActive === false && key) disabled.add(key);
                });
                // Map keys back to ids
                const disabledIds = new Set();
                state.menuData.forEach(item => {
                    const key = computeProductKey(item);
                    if(disabled.has(key)) disabledIds.add(item.id);
                });
                // Build extras for products that are only in Firestore
                overrides.forEach((data, key) => {
                    const exists = state.menuData.some(i => computeProductKey(i) === key);
                    if(!exists) {
                        extras.push({
                            id: `custom-${key}`,
                            name: data.name,
                            cat: data.cat,
                            price: data.price || 0,
                            diet: data.diet || ['carne/pesce'],
                            isActive: data.isActive !== false
                        });
                        if(data.isActive === false) disabledIds.add(`custom-${key}`);
                    }
                });
                state.menuOverrides = overrides;
                state.menuExtras = extras;
                state.disabledProducts = disabledIds;
                saveDisabledProducts();
                renderMenu();
                renderMenuAdmin();
            });
        }

        function syncCustomCreations() {
            if(state.subs.custom) return;
            state.subs.custom = onSnapshot(query(customCreationsCol, orderBy("createdAt", "desc")), snap => {
                state.customCreations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderCustomCreations();
            });
        }

        function syncMenuAudit() {
            if(state.subs.menuAudit) return;
            state.subs.menuAudit = onSnapshot(query(menuAuditCol, orderBy("createdAt", "desc"), limit(10)), snap => {
                state.menuAudit = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderMenuAudit();
            });
        }

        function renderMenuAudit() {
            const list = document.getElementById('menu-audit-list');
            const last = document.getElementById('menu-audit-last');
            if(!list) return;
            const items = filterMenuAudit(state.menuAudit || []);
            if(last) {
                if(state.menuAudit && state.menuAudit.length) {
                    const a = state.menuAudit[0];
                    const when = a.createdAt ? formatTime(a.createdAt) : '--:--';
                    const who = a.actorEmail || 'utente';
                    const what = a.payload?.name || a.payload?.key || '—';
                    last.textContent = `${what} · ${who} · ${when}`;
                } else {
                    last.textContent = 'Nessuna modifica recente';
                }
            }
            if(!items.length) {
                list.innerHTML = `<div class="text-[11px] text-gray-500 font-bold">Nessuna attività recente.</div>`;
                return;
            }
            list.innerHTML = items.map(a => {
                const when = a.createdAt ? formatTime(a.createdAt) : '--:--';
                const actor = a.actorEmail || 'utente';
                const action = (a.action || '').toUpperCase();
                const name = a.payload?.name || a.payload?.key || '';
                const price = a.payload?.price ? formatCurrency(a.payload.price) : '';
                const active = typeof a.payload?.isActive === 'boolean' ? (a.payload.isActive ? 'Attivo' : 'Disattivato') : '';
                const detail = [name, price, active].filter(Boolean).join(' · ');
                return `
                    <div class="bg-white p-3 rounded-2xl border border-gray-100">
                        <div class="flex items-center justify-between">
                            <p class="text-[10px] font-black uppercase text-gray-400">${action}</p>
                            <span class="text-[10px] text-gray-400 font-bold">${when}</span>
                        </div>
                        <p class="text-[11px] font-bold">${esc(detail)}</p>
                        <p class="text-[10px] text-gray-500">da ${esc(actor)}</p>
                    </div>
                `;
            }).join('');
        }

        function filterMenuAudit(items) {
            const f = state.menuAuditFilter;
            if(f === 'all') return items;
            if(f === 'price') return items.filter(i => i.action === 'price');
            if(f === 'availability') return items.filter(i => i.action === 'availability');
            if(f === 'create') return items.filter(i => i.action === 'create');
            if(f === 'update') return items.filter(i => i.action === 'update');
            return items;
        }

        window.setMenuAuditFilter = (filter) => {
            state.menuAuditFilter = filter;
            ['all','price','availability','create','update'].forEach(f => {
                const btn = document.getElementById(`menu-audit-filter-${f}`);
                if(!btn) return;
                btn.classList.toggle('btn-primary', filter === f);
                btn.classList.toggle('btn-ghost', filter !== f);
            });
            renderMenuAudit();
        };

        window.exportMenuAudit = async () => {
            try {
                const snap = await getDocs(query(menuAuditCol, orderBy("createdAt", "desc"), limit(200)));
                const fmt = (n) => {
                    if(n === null || n === undefined || n === '') return '';
                    const num = Number(n);
                    if(Number.isNaN(num)) return '';
                    return num.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                };
                let csv = "Timestamp;Azione;Prodotto;Categoria;Prezzo;Attivo;Utente;Ruolo\n";
                snap.forEach(d => {
                    const a = d.data();
                    const ts = a.createdAt?.toDate();
                    csv += `${ts ? ts.toLocaleString() : ''};${a.action || ''};${a.payload?.name || ''};${a.payload?.cat || ''};${fmt(a.payload?.price)};${typeof a.payload?.isActive === 'boolean' ? (a.payload.isActive ? 'Si' : 'No') : ''};${a.actorEmail || ''};${a.actorRole || ''}\n`;
                });
                const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Audit_Menu.csv"; link.click();
            } catch(e) {
                console.warn('menu audit export failed', e);
                window.toast("Errore export audit");
            }
        };

        window.voteCreation = async (id) => {
            if(!state.user) return window.toast("Accedi per votare");
            try {
                await runTransaction(db_fb, async (tx) => {
                    const ref = doc(db_fb, "custom_creations", id);
                    const snap = await tx.get(ref);
                    if(!snap.exists()) return;
                    const data = snap.data();
                    const voters = data.voters || {};
                    if(voters[state.user.email]) return;
                    if(data.ownerEmail === state.user.email) return;
                    voters[state.user.email] = true;
                    const votes = (data.votes || 0) + 1;
                    tx.update(ref, { voters, votes, updatedAt: serverTimestamp() });
                });
            } catch(e) {
                console.warn('vote failed', e);
                window.toast("Errore voto");
            }
        };

        window.setCustomFilter = (filter) => {
            state.customFilter = filter;
            ['all','Panino','Pizza Ripiena'].forEach(f => {
                const btn = document.getElementById(`custom-filter-${f === 'all' ? 'all' : (f === 'Panino' ? 'panino' : 'pizza')}`);
                if(btn) btn.classList.toggle('btn-primary', filter === f);
                if(btn) btn.classList.toggle('btn-ghost', filter !== f);
            });
            renderCustomCreations();
        };

        function renderCustomCreations() {
            const list = document.getElementById('custom-history-list');
            const topMonth = document.getElementById('custom-top-month');
            const topAll = document.getElementById('custom-top-all');
            if(!list || !topMonth || !topAll) return;
            const filter = state.customFilter;
            const data = state.customCreations || [];
            const filtered = filter === 'all' ? data : data.filter(c => c.type === filter);
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthItems = filtered.filter(c => c.createdAt && c.createdAt.toDate && c.createdAt.toDate() >= monthStart);
            const topM = [...monthItems].sort((a,b) => (b.votes||0) - (a.votes||0))[0];
            const topA = [...filtered].sort((a,b) => (b.votes||0) - (a.votes||0))[0];
            topMonth.textContent = topM ? `Top mese: ${topM.name} (${topM.votes||0} voti)` : 'Top mese: n.d.';
            topAll.textContent = topA ? `Top sempre: ${topA.name} (${topA.votes||0} voti)` : 'Top sempre: n.d.';

            if(!filtered.length) {
                list.innerHTML = `<div class="text-[11px] text-gray-500 font-bold">Nessuna creazione salvata.</div>`;
                return;
            }
            list.innerHTML = filtered.map(c => {
                const ingredients = (c.ingredients || []).join(', ');
                const isOwner = c.ownerEmail === state.user?.email;
                const hasVoted = c.voters && state.user?.email && c.voters[state.user.email];
                const disabled = isOwner || hasVoted;
                const voteLabel = isOwner ? 'Tuo' : (hasVoted ? 'Votato' : 'Vota');
                return `
                    <div class="bg-white p-4 rounded-2xl border border-gray-100 flex flex-wrap items-center gap-3">
                        <div class="flex-1 min-w-[220px]">
                            <p class="font-black text-sm">${esc(c.name)} <span class="chip chip-quiet">${esc(c.type)}</span></p>
                            <p class="text-[10px] text-gray-500">di ${esc(c.ownerName || c.ownerEmail || 'Utente')}</p>
                            <p class="text-[11px] text-gray-700 mt-1">${esc(ingredients)}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="badge">${c.votes || 0} voti</span>
                            <button data-action="custom-vote" data-id="${c.id}" class="btn btn-ghost text-[10px] px-3 py-2" ${disabled ? 'disabled' : ''}>${voteLabel}</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function syncOrders() {
            if(state.subs.orders) return;
            const now = new Date(); now.setHours(0,0,0,0);
            state.subs.orders = onSnapshot(query(ordersCol, orderBy("createdAt", "desc")), snap => {
                let totalG = 0;
                const rawToday = snap.docs
                    .map(d => ({id: d.id, ...d.data()}))
                    .filter(o => o.createdAt && o.createdAt.toDate() >= now);
                state.ordersRawToday = rawToday;
                state.ordersToday = rawToday.filter(isValidOrder);
                const listEl = document.getElementById('all-orders-list');
                if(state.ordersToday.length === 0) {
                    listEl.innerHTML = `<div class="card p-6 rounded-3xl text-center text-gray-400 font-bold uppercase">Nessun ordine valido oggi</div>`;
                } else {
                    listEl.innerHTML = state.ordersToday.map(o => {
                        totalG += o.total || 0;
                        const paid = o.paymentStatus === "paid";
                        const badge = paid ? `<span class="badge badge-green"><i class="fas fa-check"></i>Pagato</span>` : `<span class="badge badge-amber"><i class="fas fa-clock"></i>Da verificare</span>`;
                        const time = formatTime(o.createdAt);
                        const items = (o.items || []).map(i => {
                            const label = i.details && i.details !== "" ? `${i.name} (${i.details})` : i.name;
                            return `<span class="chip chip-quiet">${esc(label)}</span>`;
                        }).join('');
                        const notes = o.allergies && o.allergies.trim().length > 0
                            ? `<div class="mt-2 text-[11px] text-red-700 font-bold">⚠️ ${esc(o.allergies.trim())}</div>`
                            : '';
                        const statusLabel = (o.orderStatus || 'submitted').toUpperCase();
                        const statusBar = (isAdmin() || isRistoratore()) ? `
                            <div class="mt-3 flex flex-wrap items-center gap-2">
                                <span class="badge badge-quiet">Stato: ${esc(statusLabel)}</span>
                                <button data-action="order-set-status" data-id="${o.id}" data-status="accepted" class="btn btn-ghost text-[10px] px-3 py-2">In preparazione</button>
                                <button data-action="order-set-status" data-id="${o.id}" data-status="completed" class="btn btn-ghost text-[10px] px-3 py-2">Pronto</button>
                                <button data-action="order-set-status" data-id="${o.id}" data-status="delivered" class="btn btn-primary text-[10px] px-3 py-2">Consegnato</button>
                            </div>
                        ` : '';
                        return `
                            <div class="card p-5 rounded-3xl border-l-8 border-primary text-left">
                                <div class="card-header">
                                    <div>
                                        <p class="font-black text-sm text-gray-800">${esc(o.user)}</p>
                                        <div class="card-meta mt-1">
                                            <span class="chip">${time}</span>
                                            ${badge}
                                            <span class="chip">Totale ${formatCurrency(o.total || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-2">${items}</div>
                                ${notes}
                                ${statusBar}
                            </div>
                        `;
                    }).join('');
                }
                document.getElementById('grand-total-display').textContent = formatCurrency(totalG);
                renderOrdersPayments();
                renderOrdersKPIs();
                renderKitchenSummary();
                renderDailySummaryInline();
                updateInvalidOrdersUI();
                autoVoidInvalidOrders();
            });
        }

        function buildKitchenSummary() {
            const itemCounts = new Map();
            let totalItems = 0;
            state.ordersToday.forEach(o => {
                (o.items || []).forEach(i => {
                    const label = i.details && i.details !== "" ? `${i.name} (${i.details})` : i.name;
                    itemCounts.set(label, (itemCounts.get(label) || 0) + 1);
                    totalItems += 1;
                });
            });
            const itemsSorted = Array.from(itemCounts.entries())
                .map(([label, count]) => ({ label, count }))
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
            return { itemsSorted, totalOrders: state.ordersToday.length, totalItems };
        }

        function renderKitchenSummary() {
            const productsEl = document.getElementById('orders-summary-products');
            const allergiesEl = document.getElementById('orders-summary-allergies');
            const countEl = document.getElementById('orders-summary-count');
            if(!productsEl || !allergiesEl || !countEl) return;

            if(state.ordersToday.length === 0) {
                productsEl.innerHTML = `<p class="text-gray-400">Nessun ordine presente.</p>`;
                allergiesEl.innerHTML = `<p class="text-gray-400">Nessuna nota.</p>`;
                countEl.textContent = "";
                return;
            }

            const { itemsSorted, totalOrders, totalItems } = buildKitchenSummary();
            countEl.textContent = `${totalOrders} ordini · ${totalItems} pezzi`;

            productsEl.innerHTML = itemsSorted.map(i => `
                <div class="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100">
                    <span class="font-semibold text-gray-700">${esc(i.label)}</span>
                    <span class="badge">${i.count}x</span>
                </div>
            `).join('');

            const allergies = state.ordersToday
                .filter(o => o.allergies && o.allergies.trim().length > 0)
                .map(o => ({
                    user: o.user,
                    note: o.allergies.trim()
                }));

            allergiesEl.innerHTML = allergies.length === 0
                ? `<p class="text-gray-400">Nessuna nota o allergia.</p>`
                : allergies.map(a => `
                    <div class="bg-white px-3 py-2 rounded-xl border border-red-100">
                        <p class="text-[10px] font-black uppercase text-red-700">${esc(a.user)}</p>
                        <p class="text-[11px] text-gray-700">${esc(a.note)}</p>
                    </div>
                `).join('');
        }

        function renderDailySummaryInline() {
            const wrap = document.getElementById('daily-summary-inline');
            const productsEl = document.getElementById('daily-summary-products');
            const allergiesEl = document.getElementById('daily-summary-allergies');
            const countEl = document.getElementById('daily-summary-count');
            const titleEl = document.getElementById('daily-summary-title');
            const adminLink = document.getElementById('daily-summary-admin-link');
            if(!wrap || !productsEl || !allergiesEl || !countEl || !titleEl || !adminLink) return;

            if(isAdmin() || isRistoratore()) {
                wrap.classList.remove('hidden');
                adminLink.classList.remove('hidden');
                titleEl.textContent = "Riepilogo Ordini Oggi";
                if(state.ordersToday.length === 0) {
                    productsEl.innerHTML = `<p class="text-gray-400">Nessun ordine presente.</p>`;
                    allergiesEl.innerHTML = `<p class="text-gray-400">Nessuna nota.</p>`;
                    countEl.textContent = "";
                    return;
                }
                const { itemsSorted, totalOrders, totalItems } = buildKitchenSummary();
                countEl.textContent = `${totalOrders} ordini · ${totalItems} pezzi`;
                productsEl.innerHTML = itemsSorted.map(i => `
                    <div class="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100">
                        <span class="font-semibold text-gray-700">${esc(i.label)}</span>
                        <span class="badge">${i.count}x</span>
                    </div>
                `).join('');
                const allergies = state.ordersToday
                    .filter(o => o.allergies && o.allergies.trim().length > 0)
                    .map(o => ({
                        user: o.user,
                        note: o.allergies.trim()
                    }));
                allergiesEl.innerHTML = allergies.length === 0
                    ? `<p class="text-gray-400">Nessuna nota o allergia.</p>`
                    : allergies.map(a => `
                        <div class="bg-white px-3 py-2 rounded-xl border border-red-100">
                            <p class="text-[10px] font-black uppercase text-red-700">${esc(a.user)}</p>
                            <p class="text-[11px] text-gray-700">${esc(a.note)}</p>
                        </div>
                    `).join('');
                return;
            }

            // Utenti standard: mostra solo i propri ordini
            adminLink.classList.add('hidden');
            if(!state.user) { wrap.classList.add('hidden'); return; }
            wrap.classList.remove('hidden');
            titleEl.textContent = "Il tuo riepilogo oggi";
            const now = new Date(); now.setHours(0,0,0,0);
            const myOrdersToday = (state.myOrders || []).filter(o => {
                if(!isValidOrder(o)) return false;
                if(!o.createdAt) return false;
                const d = o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
                return d >= now;
            });
            if(myOrdersToday.length === 0) {
                productsEl.innerHTML = `<p class="text-gray-400">Nessun ordine inviato oggi.</p>`;
                allergiesEl.innerHTML = `<p class="text-gray-400">Nessuna nota.</p>`;
                countEl.textContent = "";
                return;
            }
            const itemCounts = new Map();
            let totalItems = 0;
            myOrdersToday.forEach(o => {
                (o.items || []).forEach(i => {
                    const label = i.details && i.details !== "" ? `${i.name} (${i.details})` : i.name;
                    itemCounts.set(label, (itemCounts.get(label) || 0) + 1);
                    totalItems += 1;
                });
            });
            const itemsSorted = Array.from(itemCounts.entries())
                .map(([label, count]) => ({ label, count }))
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
            countEl.textContent = `${myOrdersToday.length} ordini · ${totalItems} pezzi`;
            productsEl.innerHTML = itemsSorted.map(i => `
                <div class="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100">
                    <span class="font-semibold text-gray-700">${esc(i.label)}</span>
                    <span class="badge">${i.count}x</span>
                </div>
            `).join('');
            const allergies = myOrdersToday
                .filter(o => o.allergies && o.allergies.trim().length > 0)
                .map(o => ({
                    user: o.user,
                    note: o.allergies.trim()
                }));
            allergiesEl.innerHTML = allergies.length === 0
                ? `<p class="text-gray-400">Nessuna nota o allergia.</p>`
                : allergies.map(a => `
                    <div class="bg-white px-3 py-2 rounded-xl border border-red-100">
                        <p class="text-[10px] font-black uppercase text-red-700">${esc(a.user)}</p>
                        <p class="text-[11px] text-gray-700">${esc(a.note)}</p>
                    </div>
                `).join('');
        }

        function renderRoleStatus() {
            const el = document.getElementById('role-status');
            const missingEl = document.getElementById('claims-missing');
            const banner = document.getElementById('auth-banner');
            if(!el || !missingEl) return;
            const cached = (() => {
                try { return JSON.parse(localStorage.getItem('dose_user') || 'null'); } catch(e) { return null; }
            })();
            const email = state.user?.email || cached?.email || '-';
            const role = state.user ? state.role : 'non autenticato';
            el.textContent = `${email} · ruolo: ${role}`;

            const isMapped = ROLE_EMAILS.admin.includes(email) || ROLE_EMAILS.ristoratore.includes(email) || ROLE_EMAILS.facility.includes(email);
            const claimsNote = (state.role === 'user' && isMapped);
            missingEl.textContent = claimsNote ? 'Claims non ancora assegnate (utente deve fare login)' : '';
            if(banner) {
                if(state.user) banner.classList.add('hidden');
                else banner.classList.remove('hidden');
            }
        }

        function syncFrige() {
            if(state.subs.frige) return;
            const now = new Date(); now.setHours(0,0,0,0);
            const unsubProducts = onSnapshot(query(frigeProductsCol, orderBy("name", "asc")), snap => {
                state.frige.products = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(p => p.active !== false);
                updateRestockOptions();
                renderFrigeProducts();
                renderFrigeKPIs();
            });

            const unsubPurchases = onSnapshot(query(frigePurchasesCol, orderBy("createdAt", "desc")), snap => {
                state.frige.purchasesToday = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(o => o.createdAt && o.createdAt.toDate() >= now);
                renderFrigePurchases();
                renderFrigePayments();
                renderFrigeKPIs();
            });

            const unsubRefills = onSnapshot(query(frigeRefillsCol, orderBy("createdAt", "desc")), snap => {
                state.frige.refillsToday = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(o => o.createdAt && o.createdAt.toDate() >= now && o.status !== "closed");
                renderFrigeRefills();
            });
            state.subs.frige = () => { unsubProducts(); unsubPurchases(); unsubRefills(); };
        }

        function syncAnalytics() {
            if(state.analytics.unsub.orders || state.analytics.unsub.frige || state.analytics.unsub.products) {
                renderAnalytics();
                return;
            }
            state.analytics.unsub.orders = onSnapshot(query(ordersCol, orderBy("createdAt", "desc")), snap => {
                state.analytics.ordersAll = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(isValidOrder);
                renderAnalytics();
            });

            state.analytics.unsub.frige = onSnapshot(query(frigePurchasesCol, orderBy("createdAt", "desc")), snap => {
                state.analytics.frigeAll = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(o => o.createdAt);
                renderAnalytics();
            });

            state.analytics.unsub.products = onSnapshot(query(frigeProductsCol, orderBy("name", "asc")), snap => {
                state.analytics.frigeProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderAnalytics();
            });

            state.analytics.unsub.refills = onSnapshot(query(frigeRefillsCol, orderBy("createdAt", "desc")), snap => {
                state.analytics.refillsOpen = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(r => r.status !== "closed");
                renderAnalytics();
            });
        }

        function renderFrigeProducts() {
            const wrap = document.getElementById('frige-products');
            let items = [...state.frige.products];
            if(state.frige.filter === 'low') items = items.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD);
            if(state.frige.filter === 'out') items = items.filter(p => (p.stock ?? 0) <= 0);
            if(items.length === 0) {
                wrap.innerHTML = `<div class="col-span-full bg-white p-6 rounded-3xl border border-gray-100 text-center text-[11px] text-gray-400 font-bold">Nessun prodotto configurato. Admin: clicca "Inizializza prodotti".</div>`;
                return;
            }

            wrap.innerHTML = items.map(p => {
                const stock = p.stock ?? 0;
                const disabled = stock <= 0;
                const stockLabel = disabled ? "Esaurito" : `${stock} disponibili`;
                const badge = disabled ? `<span class="badge badge-red"><i class="fas fa-ban"></i>Esaurito</span>` : (stock <= LOW_STOCK_THRESHOLD ? `<span class="badge badge-amber"><i class="fas fa-exclamation-triangle"></i>Basso</span>` : `<span class="badge badge-green"><i class="fas fa-check"></i>Disponibile</span>`);
                return `<div class="card p-5 rounded-[2rem] flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between">
                            <h4 class="font-black text-sm leading-tight mb-1">${esc(p.name)}</h4>
                            ${badge}
                        </div>
                        <p class="text-[9px] text-gray-300 uppercase">Frige</p>
                    </div>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-black text-primary text-lg">${formatCurrency(p.price || 0)}</span>
                            <span class="text-[9px] font-bold ${disabled ? 'text-red-400' : 'text-green-600'}">${stockLabel}</span>
                        </div>
                        <button data-action="frige-open-modal" data-id="${p.id}" class="w-full ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-secondary text-white'} font-black py-3 rounded-2xl text-[11px] uppercase" ${disabled ? 'disabled' : ''}>Acquista</button>
                        ${(isFacility() || isAdmin()) ? `<div class="flex gap-2">
                            <button data-action="frige-adjust-stock" data-id="${p.id}" data-delta="-1" class="flex-1 bg-gray-100 text-gray-700 font-black py-2 rounded-xl text-[10px]">-1</button>
                            <button data-action="frige-adjust-stock" data-id="${p.id}" data-delta="1" class="flex-1 bg-gray-100 text-gray-700 font-black py-2 rounded-xl text-[10px]">+1</button>
                        </div>
                        ${isFacility() ? `<button data-action="frige-request-refill" data-id="${p.id}" class="w-full bg-gray-100 text-gray-600 font-black py-2 rounded-xl text-[10px] uppercase">Richiedi rifornimento</button>` : ''}` : ''}
                        ${(isRistoratore() || isAdmin()) ? `<div class="flex gap-2">
                            <button data-action="frige-update-price" data-id="${p.id}" data-price="${p.price || 0}" class="flex-1 bg-gray-100 text-gray-700 font-black py-2 rounded-xl text-[10px]">Prezzo</button>
                            <button data-action="frige-toggle-active" data-id="${p.id}" data-active="${p.active !== false}" class="flex-1 bg-gray-100 text-gray-700 font-black py-2 rounded-xl text-[10px]">${p.active === false ? 'Riattiva' : 'Rimuovi'}</button>
                        </div>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

        function renderFrigePurchases() {
            const wrap = document.getElementById('frige-purchases-list');
            if(!isAdmin() && !isRistoratore()) return;
            if(state.frige.purchasesToday.length === 0) {
                wrap.innerHTML = `<div class="bg-white p-4 rounded-2xl border border-gray-100 text-[11px] text-gray-400 font-bold">Nessun acquisto oggi.</div>`;
                return;
            }
            wrap.innerHTML = state.frige.purchasesToday.map(o => {
                const t = o.createdAt ? o.createdAt.toDate() : null;
                const time = t ? `${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()}` : '';
                return `<div class="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                    <div class="min-w-0 pr-4">
                        <p class="font-black text-sm text-gray-800">${esc(o.user)}</p>
                        <p class="text-[9px] text-gray-300 font-bold truncate">${esc(o.productName)} ${time ? '(' + time + ')' : ''}</p>
                    </div>
                    <p class="font-black text-primary">${formatCurrency(o.price || 0)}</p>
                </div>`;
            }).join('');
        }

        function renderFrigeRefills() {
            const list = document.getElementById('frige-refills-list');
            if(!isAdmin() && !isRistoratore()) return;
            if(state.frige.refillsToday.length === 0) {
                list.innerHTML = `<div class="bg-white p-4 rounded-2xl border border-gray-100 text-[11px] text-gray-400 font-bold">Nessun rifornimento richiesto oggi.</div>`;
                return;
            }
            list.innerHTML = state.frige.refillsToday.map(r => {
                const t = r.createdAt ? r.createdAt.toDate() : null;
                const time = t ? `${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()}` : '';
                return `<div class="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                    <div class="min-w-0 pr-4">
                        <p class="font-black text-sm text-gray-800">${esc(r.productName)}</p>
                        <p class="text-[9px] text-gray-300 font-bold truncate">${esc(r.requestedBy || 'Facility')} ${time ? '(' + time + ')' : ''}</p>
                    </div>
                    <button data-action="frige-close-refill" data-id="${r.id}" class="bg-gray-900 text-white text-[10px] font-black px-3 py-2 rounded-xl uppercase">Evasa</button>
                </div>`;
            }).join('');
        }

        function renderFrigePayments() {
            const wrap = document.getElementById('frige-payments-list');
            if(!isAdmin() && !isRistoratore()) return;
            const isPaidView = state.frige.paymentFilter === "paid";
            const items = state.frige.purchasesToday.filter(p => isPaidView ? p.paymentStatus === "paid" : p.paymentStatus !== "paid");
            if(items.length === 0) {
                wrap.innerHTML = `<div class="bg-white p-4 rounded-2xl border border-gray-100 text-[11px] text-gray-400 font-bold">Nessun pagamento da mostrare.</div>`;
                return;
            }
            wrap.innerHTML = items.map(p => {
                const t = p.createdAt ? p.createdAt.toDate() : null;
                const time = t ? `${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()}` : '';
                const badge = p.paymentStatus === "paid" ? `<span class="badge badge-green"><i class="fas fa-check"></i>Pagato</span>` : `<span class="badge badge-amber"><i class="fas fa-clock"></i>Da verificare</span>`;
                return `<div class="card p-4 rounded-2xl flex justify-between items-center">
                    <div class="min-w-0 pr-4">
                        <p class="font-black text-sm text-gray-800">${esc(p.user)}</p>
                        <p class="text-[9px] text-gray-300 font-bold truncate">${esc(p.productName)} ${time ? '(' + time + ')' : ''}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <p class="font-black text-primary">${formatCurrency(p.price || 0)}</p>
                        ${badge}
                        <button data-action="frige-mark-payment" data-id="${p.id}" data-status="${isPaidView ? 'pending' : 'paid'}" class="bg-gray-900 text-white text-[10px] font-black px-3 py-2 rounded-xl uppercase">
                            ${isPaidView ? 'Annulla' : 'Riconcilia'}
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        function renderFrigeKPIs() {
            const sold = state.frige.purchasesToday.length;
            const revenue = state.frige.purchasesToday.reduce((s,o) => s + (o.price || 0), 0);
            const low = state.frige.products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;
            const out = state.frige.products.filter(p => (p.stock ?? 0) <= 0).length;
            const unpaid = state.frige.purchasesToday.filter(p => p.paymentStatus !== "paid").length;
            const unpaidAmt = state.frige.purchasesToday.filter(p => p.paymentStatus !== "paid").reduce((s,o) => s + (o.price || 0), 0);
            const paid = state.frige.purchasesToday.filter(p => p.paymentStatus === "paid").length;

            const soldEl = document.getElementById('frige-kpi-sold');
            const revEl = document.getElementById('frige-kpi-revenue');
            const lowEl = document.getElementById('frige-kpi-low');
            const outEl = document.getElementById('frige-kpi-out');
            const unpaidEl = document.getElementById('frige-kpi-unpaid');
            const unpaidAmtEl = document.getElementById('frige-kpi-unpaid-amt');
            const paidEl = document.getElementById('frige-kpi-paid');
            const topEl = document.getElementById('frige-kpi-top');
            if(!soldEl) return;

            soldEl.textContent = sold.toString();
            revEl.textContent = `€${revenue.toFixed(2)}`;
            lowEl.textContent = low.toString();
            outEl.textContent = out.toString();
            unpaidEl.textContent = unpaid.toString();
            unpaidAmtEl.textContent = `€${unpaidAmt.toFixed(2)}`;
            paidEl.textContent = paid.toString();

            const counts = {};
            state.frige.purchasesToday.forEach(p => {
                const key = p.productName || 'Prodotto';
                counts[key] = (counts[key] || 0) + 1;
            });
            const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,3);
            topEl.textContent = top.length ? top.map(([n,c]) => `${n} (${c})`).join(' • ') : "Nessun dato";
        }

        function renderOrdersPayments() {
            if(!isAdmin() && !isRistoratore()) return;
            const wrap = document.getElementById('orders-payments-list');
            if(wrap) {
                wrap.classList.remove('hidden');
                wrap.style.display = 'block';
            }
            const isPaidView = state.ordersPaymentFilter === "paid";
            const items = getFilteredOrdersForReconciliation();
            if(items.length === 0) {
                wrap.innerHTML = `<div class="bg-white p-4 rounded-2xl border border-gray-100 text-[11px] text-gray-400 font-bold">Nessun pagamento da mostrare.</div>`;
                return;
            }
            wrap.innerHTML = items.map(o => {
                const t = o.createdAt ? o.createdAt.toDate() : null;
                const time = t ? `${t.getHours()}:${(t.getMinutes()<10?'0':'') + t.getMinutes()}` : '';
                const checked = state.ordersSelected[o.id] ? "checked" : "";
                const badge = isPaidView ? `<span class="badge badge-green"><i class="fas fa-check"></i>Pagato</span>` : `<span class="badge badge-amber"><i class="fas fa-clock"></i>Da verificare</span>`;
                return `<div class="card p-4 rounded-2xl flex justify-between items-center">
                    <div class="min-w-0 pr-4">
                        <label class="flex items-center gap-2 font-black text-sm text-gray-800">
                            <input type="checkbox" ${checked} data-action="orders-select" data-id="${o.id}" class="h-4 w-4">
                            ${esc(o.user)}
                        </label>
                        <p class="text-[9px] text-gray-300 font-bold truncate">${esc(o.items.map(i=>i.name).join(' • '))} ${time ? '(' + time + ')' : ''}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <p class="font-black text-primary">${formatCurrency(o.total || 0)}</p>
                        ${badge}
                        <button data-action="orders-mark-payment" data-id="${o.id}" data-status="${isPaidView ? 'pending' : 'paid'}" class="bg-gray-900 text-white text-[10px] font-black px-3 py-2 rounded-xl uppercase">
                            ${isPaidView ? 'Annulla' : 'Riconcilia'}
                        </button>
                    </div>
                </div>`;
            }).join('');
            ensureHistoryVisibleForE2E();
        }

        function renderOrdersKPIs() {
            const unpaid = state.ordersToday.filter(p => p.paymentStatus !== "paid").length;
            const unpaidAmt = state.ordersToday.filter(p => p.paymentStatus !== "paid").reduce((s,o) => s + (o.total || 0), 0);
            const paid = state.ordersToday.filter(p => p.paymentStatus === "paid").length;
            const unpaidEl = document.getElementById('orders-kpi-unpaid');
            const unpaidAmtEl = document.getElementById('orders-kpi-unpaid-amt');
            const paidEl = document.getElementById('orders-kpi-paid');
            if(!unpaidEl) return;
            unpaidEl.textContent = unpaid.toString();
            unpaidAmtEl.textContent = `€${unpaidAmt.toFixed(2)}`;
            paidEl.textContent = paid.toString();
        }

        function renderAnalytics() {
            const now = new Date(); now.setHours(0,0,0,0);
            const { start, end } = getAnalyticsRange();
            const ordersRange = state.analytics.ordersAll.filter(o => o.createdAt && inRange(o.createdAt.toDate(), start, end));
            const frigeRange = state.analytics.frigeAll.filter(o => o.createdAt && inRange(o.createdAt.toDate(), start, end));

            const ordersToday = state.analytics.ordersAll.filter(o => o.createdAt && o.createdAt.toDate() >= now);
            const frigeToday = state.analytics.frigeAll.filter(o => o.createdAt && o.createdAt.toDate() >= now);

            const ordersTodayCount = ordersToday.length;
            const ordersTodayRevenue = ordersToday.reduce((s,o) => s + (o.total || 0), 0);
            const avgTicket = ordersTodayCount ? ordersTodayRevenue / ordersTodayCount : 0;

            const ordersRangeCount = ordersRange.length;

            const frigeTodayCount = frigeToday.length;
            const frigeTodayRevenue = frigeToday.reduce((s,o) => s + (o.price || 0), 0);
            const frigePending = frigeToday.filter(o => o.paymentStatus !== "paid").length;

            const lowStock = state.analytics.frigeProducts.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;
            const menuCount = state.menuData.length;
            const frigeCount = state.analytics.frigeProducts.length;
            const refillsOpen = state.analytics.refillsOpen.length;
            const ordersPending = state.analytics.ordersAll.filter(o => o.paymentStatus !== "paid").length;

            const topCounts = {};
            frigeToday.forEach(p => { topCounts[p.productName || 'Prodotto'] = (topCounts[p.productName || 'Prodotto'] || 0) + 1; });
            const top = Object.entries(topCounts).sort((a,b) => b[1]-a[1]).slice(0,3);

            const uniqueUsers = new Set(ordersRange.map(o => o.email || o.user)).size;
            const repeatRate = ordersRange.length ? ((ordersRange.length - uniqueUsers) / ordersRange.length) : 0;

            const orderPaid = ordersRange.filter(o => o.paymentStatus === "paid").length;
            const orderPayRate = ordersRange.length ? (orderPaid / ordersRange.length) : 0;
            const frigePaid = frigeRange.filter(o => o.paymentStatus === "paid").length;
            const frigePayRate = frigeRange.length ? (frigePaid / frigeRange.length) : 0;
            const payHealth = ((orderPayRate + frigePayRate) / 2) || 0;

            const stockRisk = frigeCount ? (lowStock / frigeCount) : 0;

            const topUserCounts = {};
            ordersRange.forEach(o => { const k = o.user || 'Utente'; topUserCounts[k] = (topUserCounts[k] || 0) + 1; });
            const topUsers = Object.entries(topUserCounts).sort((a,b) => b[1]-a[1]).slice(0,5);

            const catCounts = {};
            ordersRange.forEach(o => {
                (o.items || []).forEach(i => {
                    const c = i.cat || 'Altro';
                    catCounts[c] = (catCounts[c] || 0) + 1;
                });
            });
            const topCats = Object.entries(catCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
            const totalCat = Object.values(catCounts).reduce((s,v)=>s+v,0) || 1;
            const slowMovers = Object.entries(catCounts).sort((a,b) => a[1]-b[1]).slice(0,5);

            const reconTimes = ordersRange.filter(o => o.reconciledAt && o.createdAt).map(o => {
                const a = o.createdAt.toDate().getTime();
                const b = o.reconciledAt.toDate().getTime();
                return Math.max(0, (b - a) / 60000);
            });
            const reconAvg = reconTimes.length ? (reconTimes.reduce((s,v)=>s+v,0) / reconTimes.length) : 0;

            const alerts = [];
            if(refillsOpen > 0) alerts.push(`${refillsOpen} rifornimenti aperti`);
            if(lowStock > 0) alerts.push(`${lowStock} prodotti sotto soglia`);
            if(ordersPending > 0) alerts.push(`${ordersPending} pagamenti ordini pendenti`);
            if(frigePending > 0) alerts.push(`${frigePending} pagamenti Frige pendenti`);
            if(!alerts.length) alerts.push('Nessun alert critico');

            const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            setText('analytics-orders-today', ordersTodayCount.toString());
            setText('analytics-revenue-today', `€${ordersTodayRevenue.toFixed(2)}`);
            setText('analytics-avg-today', `€${avgTicket.toFixed(2)}`);
            setText('analytics-orders-7d', ordersRangeCount.toString());
            setText('analytics-frige-today', frigeTodayCount.toString());
            setText('analytics-frige-revenue', `€${frigeTodayRevenue.toFixed(2)}`);
            setText('analytics-frige-pending', frigePending.toString());
            setText('analytics-frige-low', lowStock.toString());
            setText('analytics-top-products', top.length ? top.map(([n,c]) => `${n} (${c})`).join(' • ') : 'Nessun dato');
            setText('analytics-menu-count', menuCount.toString());
            setText('analytics-frige-count', frigeCount.toString());
            setText('analytics-refills-open', refillsOpen.toString());
            setText('analytics-orders-pending', ordersPending.toString());
            setText('analytics-updated', `Aggiornato: ${new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}`);
            setText('analytics-pay-health', `${Math.round(payHealth * 100)}%`);
            setText('analytics-stock-risk', `${Math.round(stockRisk * 100)}%`);
            setText('analytics-adoption', `${uniqueUsers} utenti / ${ordersRange.length} ordini`);
            setText('analytics-pay-rate', `${Math.round(((orderPayRate+frigePayRate)/2)*100)}%`);
            setText('analytics-pay-open', `${ordersPending + frigePending}`);
            setText('analytics-recon-avg', reconAvg ? `${Math.round(reconAvg)} min` : 'n.d.');
            setText('analytics-top-users', topUsers.length ? topUsers.map(([u,c]) => `${u} (${c})`).join(' • ') : 'Nessun dato');
            setText('analytics-top-categories', topCats.length ? topCats.map(([c,n]) => `${c} (${n})`).join(' • ') : 'Nessun dato');
            setText('analytics-alerts', alerts.join(' • '));
            renderMixBars(topCats, totalCat);
            setText('analytics-slow-movers', slowMovers.length ? slowMovers.map(([c,n]) => `${c} (${n})`).join(' • ') : 'Nessun dato');

            renderAnalyticsCharts(ordersRange, frigeRange, start, end);
            renderTargetVsActual(ordersRange, frigeRange);
            renderForecast(ordersRange);
        }

        function renderTargetVsActual(ordersRange, frigeRange) {
            const ordTarget = state.analytics.targets.orders;
            const friTarget = state.analytics.targets.frige;
            const ordActual = ordersRange.length;
            const friActual = frigeRange.length;
            const ordMin = ordTarget?.min ?? null;
            const ordMax = ordTarget?.max ?? null;
            const friMin = friTarget?.min ?? null;
            const friMax = friTarget?.max ?? null;
            const ordDelta = ordMax !== null ? ((ordActual - ordMax) / (ordMax || 1)) * 100 : null;
            const friDelta = friMax !== null ? ((friActual - friMax) / (friMax || 1)) * 100 : null;
            const ordTxt = ordMax !== null ? `${ordActual} vs ${ordMax} (${ordDelta >= 0 ? '+' : ''}${ordDelta.toFixed(1)}%)` : 'Imposta target';
            const friTxt = friMax !== null ? `${friActual} vs ${friMax} (${friDelta >= 0 ? '+' : ''}${friDelta.toFixed(1)}%)` : 'Imposta target';

            const rev = ordersRange.reduce((s,o)=>s+(o.total||0),0);
            const avgTicket = ordersRange.length ? (rev / ordersRange.length) : 0;
            const revTarget = ordMax !== null ? (ordMax * avgTicket) : null;
            const revDelta = revTarget ? ((rev - revTarget)/revTarget)*100 : null;
            const revTxt = revTarget ? `€${rev.toFixed(2)} vs €${revTarget.toFixed(2)} (${revDelta>=0?'+':''}${revDelta.toFixed(1)}%)` : 'Imposta target ordini';

            const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            setText('analytics-target-orders', ordTxt);
            setText('analytics-target-frige', friTxt);
            setText('analytics-target-revenue', revTxt);
        }

        function renderForecast(ordersRange) {
            const weekly = buildSeries(ordersRange, new Date(Date.now() - 1000*60*60*24*112), new Date(), 'weekly', o => 1);
            const y = weekly.counts;
            if(!y.length) {
                const forecastEl = document.getElementById('analytics-forecast');
                if(forecastEl) forecastEl.textContent = 'Nessun dato';
                const formulaEl = document.getElementById('analytics-forecast-formula');
                if(formulaEl) formulaEl.textContent = '';
                return;
            }
            // linear regression on last N weeks
            const n = Math.min(12, y.length);
            const ys = y.slice(-n);
            const xs = ys.map((_,i) => i + 1);
            const xAvg = xs.reduce((s,v)=>s+v,0) / n;
            const yAvg = ys.reduce((s,v)=>s+v,0) / n;
            let num = 0, den = 0;
            for(let i=0;i<n;i++){ num += (xs[i]-xAvg)*(ys[i]-yAvg); den += (xs[i]-xAvg)**2; }
            const slope = den ? num/den : 0;
            const intercept = yAvg - slope * xAvg;
            const forecast = Array.from({length:4}, (_,i) => Math.max(0, Math.round(intercept + slope * (n + i + 1))));
            const forecastEl = document.getElementById('analytics-forecast');
            if(forecastEl) forecastEl.textContent = forecast.length ? forecast.map((v,i)=>`Settimana +${i+1}: ${v}`).join(' • ') : 'Nessun dato';
            const formulaEl = document.getElementById('analytics-forecast-formula');
            if(formulaEl) formulaEl.textContent = `Modello: regressione lineare ultime ${n} settimane`;
        }

        function renderMixBars(topCats, total) {
            const wrap = document.getElementById('analytics-mix-bars');
            if(!wrap) return;
            if(!topCats.length) {
                wrap.innerHTML = '<div class="text-[11px] text-gray-600 font-bold">Nessun dato</div>';
                return;
            }
            wrap.innerHTML = topCats.map(([c,n]) => {
                const pct = Math.round((n/total)*100);
                return `<div>
                    <div class="flex justify-between text-[10px] text-gray-600 font-bold mb-1"><span>${esc(c)}</span><span>${pct}%</span></div>
                    <svg viewBox="0 0 100 6" class="w-full h-2" aria-hidden="true">
                        <rect width="100" height="6" rx="3" fill="#f3f4f6"></rect>
                        <rect width="${pct}" height="6" rx="3" fill="#d6804f"></rect>
                    </svg>
                </div>`;
            }).join('');
        }

        function getAnalyticsRange() {
            const today = new Date(); today.setHours(0,0,0,0);
            const range = state.analytics.range;
            if(range === 'today') return { start: today, end: new Date() };
            if(range === '7d') {
                const s = new Date(today); s.setDate(s.getDate()-6);
                return { start: s, end: new Date() };
            }
            if(range === '30d') {
                const s = new Date(today); s.setDate(s.getDate()-29);
                return { start: s, end: new Date() };
            }
            if(range === 'month') {
                const s = new Date(today); s.setMonth(s.getMonth()-1);
                return { start: s, end: new Date() };
            }
            if(range === 'quarter') {
                const s = new Date(today); s.setMonth(s.getMonth()-3);
                return { start: s, end: new Date() };
            }
            if(range === 'all') {
                const s = getEarliestDataDate() || new Date(2000, 0, 1);
                return { start: s, end: new Date() };
            }
            const startInput = document.getElementById('analytics-start')?.value;
            const endInput = document.getElementById('analytics-end')?.value;
            if(startInput && endInput) {
                const s = new Date(startInput); s.setHours(0,0,0,0);
                const e = new Date(endInput); e.setHours(23,59,59,999);
                return { start: s, end: e };
            }
            return { start: today, end: new Date() };
        }

        function inRange(d, start, end) {
            return d >= start && d <= end;
        }

        function getEarliestDataDate() {
            const dates = [];
            state.analytics.ordersAll.forEach(o => { if(o.createdAt) dates.push(o.createdAt.toDate()); });
            state.analytics.frigeAll.forEach(o => { if(o.createdAt) dates.push(o.createdAt.toDate()); });
            if(!dates.length) return null;
            const min = dates.reduce((a,b) => a < b ? a : b);
            min.setHours(0,0,0,0);
            return min;
        }

        window.setAnalyticsRange = (range) => {
            state.analytics.range = range;
            if(range !== 'custom') state.analytics.lastPreset = range;
            const todayBtn = document.getElementById('analytics-range-today');
            const d7Btn = document.getElementById('analytics-range-7d');
            const d30Btn = document.getElementById('analytics-range-30d');
            const allBtn = document.getElementById('analytics-range-all');
            const monthBtn = document.getElementById('analytics-range-month');
            const quarterBtn = document.getElementById('analytics-range-quarter');
            [todayBtn, d7Btn, d30Btn, allBtn, monthBtn, quarterBtn].forEach(b => b.classList.remove('bg-primary','text-white'));
            [todayBtn, d7Btn, d30Btn, allBtn, monthBtn, quarterBtn].forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
            if(range === 'today') { todayBtn.classList.remove('bg-gray-100','text-gray-700'); todayBtn.classList.add('bg-primary','text-white'); }
            if(range === '7d') { d7Btn.classList.remove('bg-gray-100','text-gray-700'); d7Btn.classList.add('bg-primary','text-white'); }
            if(range === '30d') { d30Btn.classList.remove('bg-gray-100','text-gray-700'); d30Btn.classList.add('bg-primary','text-white'); }
            if(range === 'all') { allBtn.classList.remove('bg-gray-100','text-gray-700'); allBtn.classList.add('bg-primary','text-white'); }
            if(range === 'month') { monthBtn.classList.remove('btn-ghost'); monthBtn.classList.add('btn-primary'); }
            if(range === 'quarter') { quarterBtn.classList.remove('btn-ghost'); quarterBtn.classList.add('btn-primary'); }
            renderAnalytics();
        };

        window.runQuickAnalysis = (type) => {
            const { start, end } = getAnalyticsRange();
            const ordersRange = state.analytics.ordersAll.filter(o => o.createdAt && inRange(o.createdAt.toDate(), start, end));
            const frigeRange = state.analytics.frigeAll.filter(o => o.createdAt && inRange(o.createdAt.toDate(), start, end));
            let text = '';
            if(type === 'peak') {
                const buckets = new Array(24).fill(0);
                ordersRange.forEach(o => buckets[o.createdAt.toDate().getHours()]++ );
                frigeRange.forEach(o => buckets[o.createdAt.toDate().getHours()]++ );
                const max = Math.max(...buckets);
                const hour = buckets.indexOf(max);
                text = max > 0 ? `Orario di picco: ${hour}:00 (${max} ordini)` : 'Nessun dato nel periodo selezionato.';
            }
            if(type === 'topUsers') {
                const counts = {};
                ordersRange.forEach(o => { counts[o.user || 'Utente'] = (counts[o.user || 'Utente'] || 0) + 1; });
                const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,3);
                text = top.length ? `Top utenti: ${top.map(([u,c]) => `${u} (${c})`).join(' • ')}` : 'Nessun dato nel periodo selezionato.';
            }
            if(type === 'topItems') {
                const counts = {};
                frigeRange.forEach(o => { counts[o.productName || 'Prodotto'] = (counts[o.productName || 'Prodotto'] || 0) + 1; });
                const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,3);
                text = top.length ? `Top prodotti: ${top.map(([n,c]) => `${n} (${c})`).join(' • ')}` : 'Nessun dato nel periodo selezionato.';
            }
            const el = document.getElementById('analytics-insights'); if(el) el.textContent = text;
        };

        window.exportAnalyticsCSV = () => {
            const { start, end } = getAnalyticsRange();
            const ordersRange = state.analytics.ordersAll.filter(o => o.createdAt && inRange(o.createdAt.toDate(), start, end));
            const frigeRange = state.analytics.frigeAll.filter(o => o.createdAt && inRange(o.createdAt.toDate(), start, end));
            let csv = "Tipo;Timestamp;Utente;Descrizione;Totale\\n";
            ordersRange.forEach(o => {
                const ts = o.createdAt?.toDate();
                csv += `Ordine;${ts ? ts.toISOString() : ''};${o.user};${o.items.map(i=>i.name).join(' | ')};${(o.total || 0).toFixed(2)}\\n`;
            });
            frigeRange.forEach(o => {
                const ts = o.createdAt?.toDate();
                csv += `Frige;${ts ? ts.toISOString() : ''};${o.user};${o.productName};${(o.price || 0).toFixed(2)}\\n`;
            });
            const blob = new Blob([`\\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Analisi_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
        };

        window.exportAnalyticsPDF = () => {
            document.body.classList.add('print-mode');
            const el = document.getElementById('print-generated-at');
            if(el) el.textContent = new Date().toLocaleString('it-IT');
            window.print();
            setTimeout(() => document.body.classList.remove('print-mode'), 500);
        };

        window.setChartResolution = (type, mode) => {
            state.analytics.resolution[type] = mode;
            const dailyBtn = document.getElementById(`${type}-res-daily`);
            const weeklyBtn = document.getElementById(`${type}-res-weekly`);
            [dailyBtn, weeklyBtn].forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
            if(mode === 'daily') { dailyBtn.classList.remove('btn-ghost'); dailyBtn.classList.add('btn-primary'); }
            if(mode === 'weekly') { weeklyBtn.classList.remove('btn-ghost'); weeklyBtn.classList.add('btn-primary'); }
            renderAnalytics();
        };

        window.applyTarget = (type) => {
            const minInput = document.getElementById(`${type}-target-min`);
            const maxInput = document.getElementById(`${type}-target-max`);
            if(!minInput || !maxInput) return;
            const minVal = parseFloat(minInput.value);
            const maxVal = parseFloat(maxInput.value);
            state.analytics.targets[type] = {
                min: Number.isNaN(minVal) ? null : minVal,
                max: Number.isNaN(maxVal) ? null : maxVal
            };
            saveUserTargets();
            renderAnalytics();
        };

        function saveUserTargets() {
            const key = `dose_targets_${state.user?.email || 'anon'}`;
            localStorage.setItem(key, JSON.stringify(state.analytics.targets));
        }

        function loadUserTargets() {
            const key = `dose_targets_${state.user?.email || 'anon'}`;
            const raw = localStorage.getItem(key);
            if(!raw) return;
            try {
                const t = JSON.parse(raw);
                state.analytics.targets.orders = t.orders ?? { min: null, max: null };
                state.analytics.targets.frige = t.frige ?? { min: null, max: null };
                const ordersMin = document.getElementById('orders-target-min');
                const ordersMax = document.getElementById('orders-target-max');
                const frigeMin = document.getElementById('frige-target-min');
                const frigeMax = document.getElementById('frige-target-max');
                if(ordersMin && t.orders?.min !== undefined && t.orders?.min !== null) ordersMin.value = t.orders.min;
                if(ordersMax && t.orders?.max !== undefined && t.orders?.max !== null) ordersMax.value = t.orders.max;
                if(frigeMin && t.frige?.min !== undefined && t.frige?.min !== null) frigeMin.value = t.frige.min;
                if(frigeMax && t.frige?.max !== undefined && t.frige?.max !== null) frigeMax.value = t.frige.max;
            } catch(e) {}
        }

        function bindChartZoom(canvasId, type) {
            const canvas = document.getElementById(canvasId);
            if(!canvas) return;
            let dragging = false;
            let startX = 0;
            let endX = 0;
            canvas.addEventListener('mousedown', (e) => { dragging = true; startX = e.offsetX; endX = e.offsetX; state.analytics.zoom[type] = { active: true, startX, endX }; renderAnalytics(); });
            canvas.addEventListener('mousemove', (e) => { if(dragging) { endX = e.offsetX; state.analytics.zoom[type] = { active: true, startX, endX }; renderAnalytics(); } });
            canvas.addEventListener('mouseup', () => {
                if(!dragging) return;
                dragging = false;
                state.analytics.zoom[type] = null;
                const data = state.analytics.chartData[type];
                if(!data || !data.keys) return;
                if(data.mode === 'weekly') { window.toast('Zoom disponibile solo in modalità giornaliera'); return; }
                const left = 28;
                const right = 8;
                const chartW = canvas.width - left - right;
                const barW = chartW / Math.max(1, data.keys.length);
                const s = Math.max(0, Math.floor((Math.min(startX, endX) - left) / barW));
                const e = Math.min(data.keys.length - 1, Math.floor((Math.max(startX, endX) - left) / barW));
                const startKey = data.keys[s]?.start;
                const endKey = data.keys[e]?.end;
                if(!startKey || !endKey) return;
                const startDate = new Date(startKey);
                const endDate = new Date(endKey);
                document.getElementById('analytics-start').value = startDate.toISOString().slice(0,10);
                document.getElementById('analytics-end').value = endDate.toISOString().slice(0,10);
                window.setAnalyticsRange('custom');
            });
        }

        window.resetAnalyticsZoom = () => {
            const last = state.analytics.lastPreset || 'today';
            document.getElementById('analytics-start').value = '';
            document.getElementById('analytics-end').value = '';
            window.setAnalyticsRange(last);
        };

        function renderAnalyticsCharts(ordersRange, frigeRange, start, end) {
            const ordersSeries = buildSeries(ordersRange, start, end, state.analytics.resolution.orders, o => 1);
            const frigeSeries = buildSeries(frigeRange, start, end, state.analytics.resolution.frige, o => 1);
            const revenueSeries = buildSeries(ordersRange, start, end, state.analytics.resolution.orders, o => o.total || 0);
            state.analytics.chartData.orders = ordersSeries;
            state.analytics.chartData.frige = frigeSeries;
            state.analytics.chartData.revenue = revenueSeries;
            const rangeLabel = `${start.toLocaleDateString('it-IT')} → ${end.toLocaleDateString('it-IT')}`;
            const ordersAvg = ordersSeries.counts.length ? (ordersSeries.counts.reduce((s,v)=>s+v,0) / ordersSeries.counts.length) : 0;
            const frigeAvg = frigeSeries.counts.length ? (frigeSeries.counts.reduce((s,v)=>s+v,0) / frigeSeries.counts.length) : 0;
            const revenueAvg = revenueSeries.counts.length ? (revenueSeries.counts.reduce((s,v)=>s+v,0) / revenueSeries.counts.length) : 0;
            const ordersSub = document.getElementById('analytics-chart-orders-sub');
            const frigeSub = document.getElementById('analytics-chart-frige-sub');
            const revenueSub = document.getElementById('analytics-chart-revenue-sub');
            const ordersMode = ordersSeries.mode === 'weekly' ? 'Settimanale' : 'Giornaliero';
            const frigeMode = frigeSeries.mode === 'weekly' ? 'Settimanale' : 'Giornaliero';
            if(ordersSub) ordersSub.textContent = `Periodo: ${rangeLabel} · ${ordersMode} · Media: ${ordersAvg.toFixed(1)}`;
            if(frigeSub) frigeSub.textContent = `Periodo: ${rangeLabel} · ${frigeMode} · Media: ${frigeAvg.toFixed(1)}`;
            if(revenueSub) revenueSub.textContent = `Periodo: ${rangeLabel} · ${ordersMode} · Media: €${revenueAvg.toFixed(2)}`;
            drawBarChart('analytics-chart-orders', ordersSeries, 'Ordini', state.analytics.targets.orders, state.analytics.zoom.orders);
            drawBarChart('analytics-chart-frige', frigeSeries, 'Frige', state.analytics.targets.frige, state.analytics.zoom.frige);
            drawBarChart('analytics-chart-revenue', revenueSeries, '€', null, null);
        }

        function buildSeries(items, start, end, forcedMode, valueFn) {
            const days = [];
            const labels = [];
            const counts = [];
            const d = new Date(start);
            d.setHours(0,0,0,0);
            while(d <= end) {
                const key = d.toISOString().slice(0,10);
                days.push(key);
                labels.push(d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
                d.setDate(d.getDate()+1);
            }
            const map = Object.fromEntries(days.map(k => [k, 0]));
            items.forEach(o => {
                const k = o.createdAt.toDate().toISOString().slice(0,10);
                if(map[k] !== undefined) map[k] += (valueFn ? valueFn(o) : 1);
            });
            days.forEach(k => counts.push(map[k]));

            const autoWeekly = days.length > 35;
            const useWeekly = forcedMode === 'weekly' || (forcedMode !== 'daily' && autoWeekly);
            if(useWeekly) {
                // aggregate weekly for readability
                const wLabels = [];
                const wCounts = [];
                const wKeys = [];
                for(let i=0;i<days.length;i+=7) {
                    const chunk = days.slice(i, i+7);
                    const sum = chunk.reduce((s,k)=>s+map[k],0);
                    const startLabel = new Date(chunk[0]).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
                    const endLabel = new Date(chunk[chunk.length-1]).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
                    wLabels.push(`${startLabel}-${endLabel}`);
                    wCounts.push(sum);
                    wKeys.push({ start: chunk[0], end: chunk[chunk.length-1] });
                }
                return { labels: wLabels, counts: wCounts, mode: 'weekly', keys: wKeys };
            }
            return { labels, counts, mode: 'daily', keys: days.map(d => ({ start: d, end: d })) };
        }

        function drawBarChart(canvasId, series, yLabel, target, zoomSel) {
            const canvas = document.getElementById(canvasId);
            if(!canvas) return;
            const ctx = canvas.getContext('2d');
            const labels = series.labels;
            const values = series.counts;
            const minBar = 18;
            const desiredW = Math.max(520, labels.length * minBar);
            const w = canvas.width = desiredW;
            const h = canvas.height = 220;
            ctx.clearRect(0,0,w,h);
            const max = Math.max(1, ...values);
            const avg = values.length ? (values.reduce((s,v)=>s+v,0) / values.length) : 0;
            const left = 28;
            const bottom = 20;
            const top = 8;
            const right = 8;
            const chartW = w - left - right;
            const chartH = h - top - bottom;
            const barW = chartW / Math.max(1, values.length);

            // background bands
            ctx.fillStyle = 'rgba(243, 241, 231, 0.55)';
            for(let i=0;i<4;i++) {
                if(i % 2 === 0) ctx.fillRect(left, top + (chartH/4)*i, chartW, chartH/4);
            }

            // grid lines + y ticks
            ctx.strokeStyle = 'rgba(209, 213, 219, 0.7)';
            ctx.lineWidth = 1;
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '10px Manrope';
            [0, 0.25, 0.5, 0.75, 1].forEach(r => {
                const y = top + chartH - chartH * r;
                ctx.beginPath();
                ctx.moveTo(left, y);
                ctx.lineTo(left + chartW, y);
                ctx.stroke();
                const val = Math.round(max * r);
                ctx.fillText(String(val), 2, y + 3);
            });

            // bars
            ctx.fillStyle = '#D6804F';
            let maxIdx = values.indexOf(max);
            values.forEach((v,i) => {
                const barH = (v / max) * chartH;
                const x = left + i*barW + 3;
                const y = top + chartH - barH;
                ctx.fillRect(x, y, Math.max(4, barW - 6), barH);
                // value label
                ctx.fillStyle = '#6B7280';
                ctx.font = '10px Manrope';
                if(v > 0) ctx.fillText(String(v), x + 2, y - 3);
                ctx.fillStyle = '#D6804F';
            });

            // avg line
            ctx.strokeStyle = 'rgba(88, 123, 87, 0.9)';
            ctx.setLineDash([4, 4]);
            const yAvg = top + chartH - (avg / max) * chartH;
            ctx.beginPath();
            ctx.moveTo(left, yAvg);
            ctx.lineTo(left + chartW, yAvg);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#587b57';
            ctx.fillText(`avg ${avg.toFixed(1)}`, left + chartW - 44, yAvg - 4);

            if(target && (target.min !== null || target.max !== null)) {
                if(target.min !== null) {
                    const tmin = Math.max(0, target.min);
                    const yT = top + chartH - (tmin / max) * chartH;
                    ctx.strokeStyle = 'rgba(88, 123, 87, 0.9)';
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(left, yT);
                    ctx.lineTo(left + chartW, yT);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#2f6b3a';
                    ctx.fillText(`min ${tmin}`, left + 6, yT - 4);
                }
                if(target.max !== null) {
                    const tmax = Math.max(0, target.max);
                    const yT = top + chartH - (tmax / max) * chartH;
                    ctx.strokeStyle = 'rgba(208, 88, 88, 0.9)';
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(left, yT);
                    ctx.lineTo(left + chartW, yT);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#b85050';
                    ctx.fillText(`max ${tmax}`, left + 6, yT - 4);
                }
            }

            // x labels
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '10px Manrope';
            labels.forEach((l,i) => {
                if(values.length > 20 && i % 2 !== 0) return;
                ctx.fillText(l, left + i*barW + 2, h - 4);
            });

            // peak label
            if(maxIdx >= 0) {
                ctx.fillStyle = '#8c502f';
                ctx.fillText('Picco', left + maxIdx*barW + 2, top + 10);
            }

            if(yLabel) {
                ctx.save();
                ctx.fillStyle = '#9CA3AF';
                ctx.font = '10px Manrope';
                ctx.fillText(yLabel, left + 2, 10);
                ctx.restore();
            }

            if(zoomSel && zoomSel.active) {
                const zLeft = Math.min(zoomSel.startX, zoomSel.endX);
                const zRight = Math.max(zoomSel.startX, zoomSel.endX);
                ctx.fillStyle = 'rgba(214, 128, 79, 0.15)';
                ctx.fillRect(zLeft, top, Math.max(1, zRight - zLeft), chartH);
                ctx.strokeStyle = 'rgba(214, 128, 79, 0.6)';
                ctx.strokeRect(zLeft, top, Math.max(1, zRight - zLeft), chartH);
            }
        }

        function getFilteredOrdersForReconciliation() {
            const isPaidView = state.ordersPaymentFilter === "paid";
            let items = state.ordersToday.filter(p => isPaidView ? p.paymentStatus === "paid" : p.paymentStatus !== "paid");
            if(state.ordersTimeFilter !== "all") {
                items = items.filter(o => {
                    if(!o.createdAt) return false;
                    const d = o.createdAt.toDate();
                    const minutes = d.getHours() * 60 + d.getMinutes();
                    const cutoff = 11 * 60 + 30;
                    return state.ordersTimeFilter === "pre1130" ? minutes <= cutoff : minutes > cutoff;
                });
            }
            return items;
        }

        function isValidOrder(o) {
            if(!o) return false;
            if(!o.createdAt) return false;
            if(!Array.isArray(o.items) || o.items.length === 0) return false;
            if((o.total || 0) <= 0) return false;
            const status = (o.orderStatus || '').toLowerCase();
            if(['void','canceled','annullato','bozza','draft'].includes(status)) return false;
            // dopo le 11:30 non sono ordini validi (solo Frige)
            const isFrigeOrder = (o.orderType || o.source || '').toString().toLowerCase() === 'frige';
            const allowAfterHours = o.allowAfterHours === true || o.afterHoursAllowed === true;
            if(!isFrigeOrder && !allowAfterHours) {
                try {
                    const d = o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
                    const minutes = d.getHours() * 60 + d.getMinutes();
                    const cutoff = 11 * 60 + 30;
                    if(minutes > cutoff) return false;
                } catch(e) {}
            }
            return true;
        }

        function shouldAutoVoidOrder(o) {
            if(!o || !o.createdAt) return false;
            if(isValidOrder(o)) return false;
            const status = (o.orderStatus || '').toLowerCase();
            if(status && !['draft','bozza',''].includes(status)) {
                // se ha già uno status non-draft ma non è valido, comunque pulisci dopo timeout
            }
            try {
                const d = o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
                const ageMin = (Date.now() - d.getTime()) / 60000;
                return ageMin >= 10; // evita di toccare ordini appena creati
            } catch(e) {
                return false;
            }
        }

        function updateInvalidOrdersUI() {
            const btn = document.getElementById('orders-cleanup-btn');
            const countEl = document.getElementById('orders-invalid-count');
            if(!btn || !countEl) return;
            const invalidCount = (state.ordersRawToday || []).filter(o => !isValidOrder(o)).length;
            countEl.textContent = invalidCount ? `(${invalidCount})` : '';
            const canSee = isAdmin() || isRistoratore();
            btn.classList.toggle('hidden', !canSee);
            btn.disabled = !canSee || invalidCount === 0;
        }

        function updateRestockOptions() {
            const select = document.getElementById('frige-restock-product');
            if(!select) return;
            select.innerHTML = state.frige.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
        }

        async function logOrderAudit(orderId, action, meta = {}) {
            try {
                await addDoc(ordersAuditCol, {
                    orderId,
                    action,
                    meta,
                    actor: state.user?.email || 'system',
                    createdAt: serverTimestamp()
                });
            } catch(e) {
                console.warn('order audit failed', e);
            }
        }

        function ensureHistoryVisibleForE2E() {
            if(!isLocalE2E) return;
            let email = state.user?.email || '';
            if(!email) {
                try { email = JSON.parse(localStorage.getItem('dose_user') || 'null')?.email || ''; } catch(e) {}
            }
            const norm = normalizeEmail(email);
            const canSee = ROLE_EMAILS.admin.includes(norm) || ROLE_EMAILS.ristoratore.includes(norm);
            if(!canSee) return;
            const history = document.getElementById('history-view');
            if(history) history.classList.add('active');
            const list = document.getElementById('orders-payments-list');
            if(list) { list.classList.remove('hidden'); list.style.display = 'block'; }
        }

        function isAdmin() { return state.role === 'admin'; }
        function isRistoratore() { return state.role === 'ristoratore'; }
        function isFacility() { return state.role === 'facility'; }

        async function setRole(email) {
            const e = normalizeEmail(email);
            const n = normalizeName(state.user?.name);
            let role = 'user';

            if(isLocalE2E) {
                if(ROLE_EMAILS.admin.includes(e) || ROLE_NAMES.admin.includes(n)) role = 'admin';
                else if(ROLE_EMAILS.ristoratore.includes(e)) role = 'ristoratore';
                else if(ROLE_EMAILS.facility.includes(e)) role = 'facility';
                state.role = role;
            } else {
                // 1) Try custom claims
                try {
                    const token = await auth_fb.currentUser?.getIdTokenResult?.();
                    const claimRole = token?.claims?.role;
                    if(['admin','ristoratore','facility','user'].includes(claimRole)) {
                        role = claimRole;
                    }
                } catch(e) {}

                // 2) Fallback to email mapping (pre-claims)
                if(role === 'user') {
                    if(ROLE_EMAILS.admin.includes(e) || ROLE_NAMES.admin.includes(n)) role = 'admin';
                    else if(ROLE_EMAILS.ristoratore.includes(e)) role = 'ristoratore';
                    else if(ROLE_EMAILS.facility.includes(e)) role = 'facility';
                }
                state.role = role;
            }

            const adminExportBtn = document.getElementById('admin-export-btn');
            const adminTools = document.getElementById('frige-admin-tools');
            const adminSummary = document.getElementById('frige-admin-summary');
            const seedBtn = document.getElementById('frige-seed-btn');
            const addForm = document.getElementById('frige-add-form');
            const restockForm = document.getElementById('frige-restock-form');
            const historyBtn = document.getElementById('btn-history');
            const analyticsBtn = document.getElementById('btn-analytics');
            const frigeBtn = document.getElementById('btn-frige');
            const frigeWip = document.getElementById('frige-wip');

            const hide = (el) => { if(el) el.classList.add('hidden'); };
            const show = (el) => { if(el) el.classList.remove('hidden'); };

            hide(adminExportBtn);
            hide(adminTools);
            hide(adminSummary);
            hide(seedBtn);
            hide(addForm);
            hide(restockForm);
            hide(historyBtn);
            hide(analyticsBtn);

            if(isAdmin()) show(adminExportBtn);
            if(isAdmin() || isRistoratore() || isFacility()) show(adminTools);
            if(isAdmin() || isRistoratore()) show(adminSummary);
            if(isAdmin()) show(seedBtn);
            if(isAdmin() || isRistoratore()) show(addForm);
            if(isAdmin() || isFacility()) show(restockForm);
            if(isAdmin() || isRistoratore()) show(historyBtn);
            if(isAdmin() || isRistoratore()) show(analyticsBtn);

            if (frigeBtn) {
                frigeBtn.classList.remove('hidden');
                if (isAdmin() || isRistoratore() || isFacility()) {
                    frigeBtn.classList.remove('nav-disabled');
                    frigeBtn.dataset.action = 'navigate';
                    frigeBtn.dataset.view = 'frige';
                    frigeBtn.setAttribute('aria-disabled', 'false');
                    if(frigeWip) frigeWip.classList.add('hidden');
                } else {
                    frigeBtn.classList.add('nav-disabled');
                    frigeBtn.dataset.action = 'noop';
                    frigeBtn.removeAttribute('data-view');
                    frigeBtn.setAttribute('aria-disabled', 'true');
                    if(frigeWip) frigeWip.classList.remove('hidden');
                }
            }

            renderRoleStatus();
            renderMenuAdminToggle();
            renderMenuAdmin();
            if(isAdmin() || isRistoratore()) syncMenuAudit();
            renderDailySummaryInline();
            updateInvalidOrdersUI();
            if(isLocalE2E && !state.e2eNavDone && (state.role === 'ristoratore' || state.role === 'admin')) {
                state.e2eNavDone = true;
                setTimeout(() => {
                    window.navigate('history');
                    const hv = document.getElementById('history-view');
                    if(hv) {
                        document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
                        hv.classList.add('active');
                    }
                    const list = document.getElementById('orders-payments-list');
                    if(list) { list.classList.remove('hidden'); list.style.display = 'block'; }
                }, 0);
            }
            ensureHistoryVisibleForE2E();
        }

        // --- INIT ---
        onAuthStateChanged(auth_fb, async (u) => { 
            if(u) {
                const email = normalizeEmail(u.email);
                const name = normalizeName(u.displayName || u.email?.split('@')[0] || '');
                state.user = { name, email };
                localStorage.setItem('dose_user', JSON.stringify(state.user));
                document.getElementById('user-modal').classList.add('hidden');
                await setRole(email);
                syncMyOrders();
                renderDailySummaryInline();
            } else {
                if(isLocalE2E && state.user?.email) {
                    document.getElementById('user-modal').classList.add('hidden');
                    await setRole(state.user.email);
                } else {
                    document.getElementById('user-modal').classList.remove('hidden');
                }
            }
        });

        const ACTION_HANDLERS = {
            'navigate': (el) => window.navigate(el.dataset.view),
            'noop': () => window.toast("Sezione in arrivo (WIP)"),
            'select-base': (el) => window.selectBase(el.dataset.base),
            'set-subtype': (el) => window.setSubtype(el.dataset.subtype),
            'add-std': (el) => window.addStdToCart(el.dataset.id),
            'add-ing': (el) => window.addIng(el.dataset.id),
            'remove-ing': (el) => window.removeIng(parseInt(el.dataset.index, 10)),
            'add-custom': () => window.addCustomToCart(),
            'toggle-availability': (el) => window.toggleProductAvailability(el.dataset.id),
            'menu-upsert': () => window.upsertMenuProduct(),
            'menu-update-price': (el) => window.updateMenuPrice(el.dataset.key),
            'refresh-menu-admin': () => window.renderMenuAdmin(),
            'toggle-menu-admin': () => window.toggleMenuAdmin(),
            'menu-audit-filter': (el) => window.setMenuAuditFilter(el.dataset.filter),
            'menu-audit-export': () => window.exportMenuAudit(),
            'remove-from-cart': (el) => window.removeFromCart(Number(el.dataset.id)),
            'custom-vote': (el) => window.voteCreation(el.dataset.id),
            'custom-filter': (el) => window.setCustomFilter(el.dataset.filter),
            'toggle-posate': () => window.togglePosate(),
            'send-order': () => window.sendOrder(),
            'copy-daily-summary': () => window.copyDailySummary(),
            'copy-kitchen-summary': () => window.copyKitchenSummary(),
            'export-history': () => window.exportFullHistory(),
            'copy-frige-summary': () => window.copyFrigeSummary(),
            'seed-frige': () => window.seedFrige(),
            'add-frige-form': () => window.addFrigeFromForm(),
            'apply-restock': () => window.applyFrigeRestock(),
            'frige-filter': (el) => window.setFrigeFilter(el.dataset.filter),
            'frige-open-modal': (el) => window.openFrigeModal(el.dataset.id),
            'frige-adjust-stock': (el) => window.adjustFrigeStock(el.dataset.id, parseInt(el.dataset.delta, 10)),
            'frige-request-refill': (el) => window.requestFrigeRefill(el.dataset.id),
            'frige-update-price': (el) => window.updateFrigePrice(el.dataset.id, parseFloat(el.dataset.price)),
            'frige-toggle-active': (el) => window.toggleFrigeActive(el.dataset.id, el.dataset.active === 'true'),
            'frige-close-refill': (el) => window.closeFrigeRefill(el.dataset.id),
            'frige-pay-filter': (el) => window.setFrigePaymentFilter(el.dataset.filter),
            'copy-frige-payments': () => window.copyFrigePayments(),
            'frige-mark-payment': (el) => window.markFrigePayment(el.dataset.id, el.dataset.status),
            'orders-pay-filter': (el) => window.setOrdersPaymentFilter(el.dataset.filter),
            'orders-time-filter': (el) => window.setOrdersTimeFilter(el.dataset.filter),
            'copy-orders-payments': () => window.copyOrdersPayments(),
            'orders-select-all': () => window.toggleSelectAllOrders(),
            'orders-reconcile-selected': () => window.reconcileSelectedOrders(),
            'orders-export-csv': () => window.exportOrdersReconciliation(),
            'orders-mark-payment': (el) => window.markOrderPayment(el.dataset.id, el.dataset.status),
            'orders-cleanup-invalid': () => window.cleanupInvalidOrders(),
            'order-set-status': (el) => window.setOrderStatus(el.dataset.id, el.dataset.status),
            'analytics-range': (el) => window.setAnalyticsRange(el.dataset.range),
            'analytics-quick': (el) => window.runQuickAnalysis(el.dataset.quick),
            'analytics-export-csv': () => window.exportAnalyticsCSV(),
            'analytics-export-pdf': () => window.exportAnalyticsPDF(),
            'chart-resolution': (el) => window.setChartResolution(el.dataset.chart, el.dataset.resolution),
            'apply-target': (el) => window.applyTarget(el.dataset.target),
            'reset-zoom': () => window.resetAnalyticsZoom(),
            'save-user': () => window.saveUserData(),
            'signin-google': () => window.signInWithGoogle(),
            'signout': () => window.signOutUser(),
            'close-frige-modal': () => window.closeFrigeModal(),
            'confirm-frige': () => window.confirmFrigePurchase(),
            'close-order-confirm': () => closeOrderConfirm(),
            'copy-order-confirm': () => copyOrderConfirm(),
            'close-send-confirm': () => closeSendConfirm(),
            'confirm-send-order': () => confirmSendOrder()
        };

        document.addEventListener('click', (event) => {
            const el = event.target.closest('[data-action]');
            if(!el) return;
            const action = el.dataset.action;
            if(action === 'orders-select') return;
            const handler = ACTION_HANDLERS[action];
            if(!handler) return;
            event.preventDefault();
            handler(el, event);
        });

        document.addEventListener('change', (event) => {
            const el = event.target.closest('[data-action]');
            if(!el) return;
            if(el.dataset.action === 'orders-select') {
                window.toggleSelectOrder(el.dataset.id);
            }
        });

        const init = () => {
            state.menuData = Object.entries(RAW_MENU).flatMap(([cat, items]) => items.map((it, idx) => ({ ...it, cat, id: cat.replace(/\s/g,'')+idx })));
            loadDisabledProducts();
            syncMenuAvailability();
            renderRoleStatus();
            renderMenuAdminToggle();
            const frigeBtn = document.getElementById('btn-frige');
            if(frigeBtn) frigeBtn.classList.remove('hidden');
            document.getElementById('category-select').innerHTML = `<option value="all">Tutte le Categorie</option>` + Object.keys(RAW_MENU).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
            document.getElementById('diet-select').innerHTML = `<option value="all">Ogni Regime</option>` + Object.entries(DIETS_CONFIG).map(([k,v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
            document.getElementById('search-input').oninput = (e) => { state.search = e.target.value; renderMenu(); };
            document.getElementById('category-select').onchange = (e) => { state.cat = e.target.value; renderMenu(); };
            document.getElementById('diet-select').onchange = (e) => { state.diet = e.target.value; renderMenu(); };
            renderMenu();
            // Refresh menu lock state every minute
            setInterval(renderMenu, 60000);
            if(window.innerWidth < 430) document.body.classList.add('compact');
            loadUserTargets();
            bindChartZoom('analytics-chart-orders', 'orders');
            bindChartZoom('analytics-chart-frige', 'frige');
            renderMenuAdmin();
            renderMyOrderStatus();
            syncCustomCreations();
            if(isLocalE2E && state.user?.email) {
                setRole(state.user.email);
            }
            ensureHistoryVisibleForE2E();
        };

        init();
