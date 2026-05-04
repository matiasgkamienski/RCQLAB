import React, { useState, useEffect, useMemo, useCallback } from "react";
import logoEmpresa from "./logo.png";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  doc,
  serverTimestamp,
  orderBy,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  setDoc,
  limit,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// ─── FIREBASE ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAWp5dbV5cDSlcHifnYnNSPea0qb_PNtHg",
  authDomain: "app-rcq-fktznc.firebaseapp.com",
  projectId: "app-rcq-fktznc",
  storageBucket: "app-rcq-fktznc.appspot.com",
  messagingSenderId: "322797584803",
  appId: "1:322797584803:web:bbd7dbeba853e9c9639a16",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ─── LINHAS E PASTAS ─────────────────────────────────────────────────────────
const LINHAS_CONFIG = [
  { linha: "Dynatint ALQ", pasta: "Dynatint ALQ" },
  { linha: "Dynatint PMA", pasta: "Dynatint PMA" },
  { linha: "Colorantes", pasta: "Colorantes" },
  { linha: "Dynatrend", pasta: "Dynatrend" },
  { linha: "Dynaspers", pasta: "Outros" },
  { linha: "Dynastamp", pasta: "Outros" },
  { linha: "Dynaflex", pasta: "Outros" },
  { linha: "Dynaseed", pasta: "Outros" },
  { linha: "Dynafast", pasta: "Outros" },
];

const PASTAS = [
  "Dynatint ALQ",
  "Dynatint PMA",
  "Colorantes",
  "Dynatrend",
  "Outros",
];

const pastaDeLinhar = (linha) =>
  LINHAS_CONFIG.find((l) => l.linha === linha)?.pasta || "Outros";

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const ITENS_POR_PAGINA = 10;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const calcularStatus = (validade) => {
  if (!validade) return "";
  const hoje = new Date();
  const venc = new Date(validade + "T00:00:00");
  const diff = (venc - hoje) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "VENCIDO";
  if (diff <= 30) return "PRÓXIMO";
  return "ATIVO";
};

const getMesValidade = (data) => {
  const d = new Date(data + "T00:00:00");
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return { ano, mes, chave: `${ano}-${mes}` };
};

const getStatusColor = (status) => {
  if (status === "VENCIDO") return "#ef4444";
  if (status === "PRÓXIMO") return "#f59e0b";
  return "#10b981";
};
const getStatusBg = (status) => {
  if (status === "VENCIDO") return "rgba(239,68,68,0.12)";
  if (status === "PRÓXIMO") return "rgba(245,158,11,0.12)";
  return "rgba(16,185,129,0.12)";
};

const validarEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const COR_PASTA = {
  "Dynatint ALQ": "#6366f1",
  "Dynatint PMA": "#0ea5e9",
  Colorantes: "#f59e0b",
  Dynatrend: "#10b981",
  Outros: "#8b5cf6",
};

// ─── EXPORTAR CSV ─────────────────────────────────────────────────────────────
const exportarCSV = (dados) => {
  const cab = [
    "Pasta",
    "Linha",
    "Local",
    "Lote",
    "Descrição",
    "Validade",
    "Status",
    "Usuário",
    "Empresa",
  ];
  const rows = dados.map((i) => [
    i.pasta,
    i.linha,
    i.local,
    i.lote,
    i.descricao,
    i.validade,
    calcularStatus(i.validade),
    i.usuario,
    i.empresa,
  ]);
  const csv = [cab, ...rows]
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cqlab_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── ÍCONES SVG ───────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
const IcoHome = () => (
  <Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
);
const IcoPlus = () => <Ico d="M12 5v14M5 12h14" />;
const IcoList = () => (
  <Ico d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
);
const IcoSearch = () => (
  <Ico d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
);
const IcoHistory = () => <Ico d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3" />;
const IcoEdit = () => (
  <Ico d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
);
const IcoTrash = () => (
  <Ico d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
);
const IcoSun = () => (
  <Ico d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z" />
);
const IcoMoon = () => (
  <Ico d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
);
const IcoLogout = () => (
  <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
);
const IcoMenu = () => <Ico d="M3 12h18M3 6h18M3 18h18" />;
const IcoClose = () => <Ico d="M18 6L6 18M6 6l12 12" />;
const IcoUsers = () => (
  <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
);
const IcoDownload = () => (
  <Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
);
const IcoFolder = () => (
  <Ico d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
);

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg =
    type === "error" ? "#ef4444" : type === "success" ? "#10b981" : "#1e293b";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        background: bg,
        color: "white",
        padding: "12px 28px",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 2000,
        fontSize: 14,
        fontWeight: 600,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        animation: "fadeUp 0.2s ease",
      }}
    >
      {message}
    </div>
  );
};

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
const ConfirmModal = ({ message, onConfirm, onCancel, dark }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1500,
    }}
    onClick={onCancel}
  >
    <div
      style={{
        background: dark ? "#1e293b" : "white",
        padding: 28,
        borderRadius: 16,
        maxWidth: 380,
        width: "90%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <p
        style={{
          marginBottom: 24,
          fontSize: 15,
          color: dark ? "#cbd5e1" : "#334155",
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button
          onClick={onConfirm}
          style={{
            background: "#ef4444",
            color: "white",
            border: "none",
            padding: "9px 24px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Confirmar
        </button>
        <button
          onClick={onCancel}
          style={{
            background: dark ? "#334155" : "#e2e8f0",
            color: dark ? "#f1f5f9" : "#334155",
            border: "none",
            padding: "9px 24px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
);

// ─── BARCHART ────────────────────────────────────────────────────────────────
const BarChart = ({ dados, dark }) => {
  const max = Math.max(...dados.map((d) => d.valor), 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: 80,
        marginTop: 8,
      }}
    >
      {dados.map((d) => (
        <div
          key={d.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${(d.valor / max) * 64}px`,
              minHeight: d.valor ? 4 : 0,
              background: d.color,
              borderRadius: "4px 4px 0 0",
              transition: "height 0.4s ease",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: dark ? "#64748b" : "#94a3b8",
              fontWeight: 600,
            }}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── SKELETON ────────────────────────────────────────────────────────────────
const Skeleton = ({ dark, rows = 5 }) => (
  <div style={{ padding: "8px 0" }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        style={{
          height: 44,
          borderRadius: 8,
          background: dark ? "#0f172a" : "#f1f5f9",
          marginBottom: 8,
          animation: "pulse 1.5s ease-in-out infinite",
          opacity: 1 - i * 0.15,
        }}
      />
    ))}
  </div>
);

// ─── FIELD ───────────────────────────────────────────────────────────────────
const Field = ({ label, error, children }) => (
  <div style={{ marginBottom: error ? 6 : 0 }}>
    {label && (
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#64748b",
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
    )}
    {children}
    {error && (
      <div
        style={{
          color: "#ef4444",
          fontSize: 12,
          marginBottom: 10,
          marginTop: -10,
        }}
      >
        {error}
      </div>
    )}
  </div>
);

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [dark, setDark] = useState(false);
  const [tela, setTela] = useState("dashboard");
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const [pastaAtiva, setPastaAtiva] = useState(PASTAS[0]);

  // ── lista agora guarda TODOS os docs da pasta (sem paginação server-side)
  const [lista, setLista] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [empresasList, setEmpresasList] = useState([]);
  const [dashStats, setDashStats] = useState({
    total: 0,
    ativo: 0,
    proximo: 0,
    vencido: 0,
  });
  const [dashRecentes, setDashRecentes] = useState([]);
  const [dashChart, setDashChart] = useState([]);
  const [dashPorPasta, setDashPorPasta] = useState({});

  const [loadingTabela, setLoadingTabela] = useState(false);
  const [loadingDash, setLoadingDash] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const [erroDados, setErroDados] = useState("");
  const [authErrors, setAuthErrors] = useState({});
  const [formErrors, setFormErrors] = useState({});

  // Paginação client-side
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [filtros, setFiltros] = useState({
    ano: "",
    mes: "",
    usuario: "",
    empresa: "",
    busca: "",
  });

  const [modoCadastro, setModoCadastro] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    senha: "",
    confirmarSenha: "",
    nome: "",
    empresa: "",
  });
  const [form, setForm] = useState({
    lote: "",
    linha: "",
    descricao: "",
    validade: "",
  });
  const [editando, setEditando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState("");

  const [loteBusca, setLoteBusca] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState(null);

  const t = useMemo(() => tema(dark), [dark]);
  const showToast = useCallback(
    (msg, type = "info") => setToast({ message: msg, type }),
    []
  );

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => {
    setSidebarAberta(windowWidth >= 768);
  }, [windowWidth]);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @keyframes fadeUp { from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
      @keyframes pulse  { 0%,100%{opacity:0.6}50%{opacity:1} }
      @keyframes spin   { to{transform:rotate(360deg)} }
      * { box-sizing:border-box; }
      ::-webkit-scrollbar{width:6px;height:6px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
      button:hover{filter:brightness(1.08)}
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && u.emailVerified) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.approved) {
              setUser(u);
              setUserData(data);
            } else {
              showToast("Conta aguarda aprovação.", "error");
              await signOut(auth);
              setUser(null);
              setUserData(null);
            }
          } else {
            showToast("Usuário não encontrado.", "error");
            await signOut(auth);
            setUser(null);
            setUserData(null);
          }
        } catch {
          showToast("Erro ao carregar usuário.", "error");
          setUser(null);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [showToast]);

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  const carregarDashboard = useCallback(async () => {
    if (!user || !userData) return;
    setLoadingDash(true);
    try {
      const constraints = [];
      if (userData.role !== "admin" && userData.empresa)
        constraints.push(where("empresa", "==", userData.empresa));

      const snap = await getDocs(
        query(collection(db, "retencoes"), ...constraints)
      );
      const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      let total = 0,
        ativo = 0,
        proximo = 0,
        vencido = 0;
      const porMes = {},
        porPasta = {};
      PASTAS.forEach((p) => {
        porPasta[p] = { total: 0, ativo: 0, proximo: 0, vencido: 0 };
      });

      todos.forEach((i) => {
        total++;
        const st = calcularStatus(i.validade);
        if (st === "ATIVO") ativo++;
        if (st === "PRÓXIMO") proximo++;
        if (st === "VENCIDO") vencido++;
        if (i.validade) {
          const ch = i.validade.slice(0, 7);
          porMes[ch] = (porMes[ch] || 0) + 1;
        }
        const p = i.pasta || "Outros";
        if (porPasta[p]) {
          porPasta[p].total++;
          if (st === "ATIVO") porPasta[p].ativo++;
          if (st === "PRÓXIMO") porPasta[p].proximo++;
          if (st === "VENCIDO") porPasta[p].vencido++;
        }
      });

      setDashStats({ total, ativo, proximo, vencido });
      setDashPorPasta(porPasta);

      const ms = Object.keys(porMes).sort().slice(-6);
      setDashChart(
        ms.map((m) => ({
          label: m.slice(5),
          valor: porMes[m],
          color: "#2563eb",
        }))
      );

      // Últimos 5: ordena client-side
      const sorted = [...todos].sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      setDashRecentes(sorted.slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDash(false);
    }
  }, [user, userData]);

  // ── TABELA — busca apenas com where simples, sem orderBy no servidor ──────────
  const carregarDados = useCallback(async () => {
    if (!user || !userData) return;
    setLoadingTabela(true);
    setErroDados("");
    try {
      // Apenas filtros de igualdade (sem orderBy) para evitar exigência de índice composto
      const constraints = [where("pasta", "==", pastaAtiva)];

      if (userData.role !== "admin" && userData.empresa)
        constraints.push(where("empresa", "==", userData.empresa));
      else if (userData.role === "admin" && filtros.empresa)
        constraints.push(where("empresa", "==", filtros.empresa));

      if (userData.role === "admin" && filtros.usuario)
        constraints.push(where("usuarioId", "==", filtros.usuario));

      if (filtros.ano)
        constraints.push(where("ano", "==", Number(filtros.ano)));
      if (filtros.mes)
        constraints.push(
          where("mes", "==", String(filtros.mes).padStart(2, "0"))
        );

      const snap = await getDocs(
        query(collection(db, "retencoes"), ...constraints)
      );
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Ordena por createdAt desc no cliente
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      setLista(docs);
      setPaginaAtual(1);
    } catch (e) {
      console.error(e);
      setErroDados("Não foi possível carregar os registros.");
    } finally {
      setLoadingTabela(false);
    }
  }, [user, userData, filtros, pastaAtiva]);

  const carregarHistorico = useCallback(async () => {
    if (!user || !userData) return;
    setLoadingHistorico(true);
    try {
      const cs = [];
      if (userData.role !== "admin" && userData.empresa)
        cs.push(where("empresa", "==", userData.empresa));
      else if (userData.role === "admin") {
        if (filtros.empresa) cs.push(where("empresa", "==", filtros.empresa));
        if (filtros.usuario) cs.push(where("usuarioId", "==", filtros.usuario));
      }
      const snap = await getDocs(query(collection(db, "historico"), ...cs));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      setHistorico(docs.slice(0, 100));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistorico(false);
    }
  }, [user, userData, filtros.empresa, filtros.usuario]);

  const carregarUsuarios = useCallback(async () => {
    if (userData?.role !== "admin") return;
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      setUsersList(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  }, [userData]);

  const carregarEmpresas = useCallback(async () => {
    if (userData?.role !== "admin") return;
    try {
      const snap = await getDocs(collection(db, "empresas"));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setEmpresasList(docs);
    } catch (e) {
      console.error(e);
    }
  }, [userData]);

  useEffect(() => {
    if (user && userData) {
      carregarDashboard();
      if (userData.role === "admin") {
        carregarUsuarios();
        carregarEmpresas();
      }
    }
  }, [user, userData, carregarDashboard, carregarUsuarios, carregarEmpresas]);

  useEffect(() => {
    if (user && userData && tela === "tabela") carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, tela, user, userData, pastaAtiva]);

  useEffect(() => {
    if (user && userData && tela === "historico") carregarHistorico();
  }, [
    filtros.empresa,
    filtros.usuario,
    tela,
    user,
    userData,
    carregarHistorico,
  ]);

  const registrarHistorico = useCallback(
    async (acao, detalhe) => {
      try {
        await addDoc(collection(db, "historico"), {
          acao,
          detalhe,
          usuario: user.displayName || user.email,
          usuarioId: user.uid,
          empresa: userData?.empresa || "",
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error(e);
      }
    },
    [user, userData]
  );

  // ── AUTH ──────────────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthErrors({});
    const erros = {};
    if (modoCadastro) {
      if (!authForm.nome.trim()) erros.nome = "Nome é obrigatório";
      if (!authForm.empresa.trim()) erros.empresa = "Empresa é obrigatória";
      if (!validarEmail(authForm.email)) erros.email = "E-mail inválido";
      if (authForm.senha.length < 6) erros.senha = "Mínimo 6 caracteres";
      if (authForm.senha !== authForm.confirmarSenha)
        erros.confirmarSenha = "Senhas não batem";
      if (Object.keys(erros).length) {
        setAuthErrors(erros);
        return;
      }
      try {
        const res = await createUserWithEmailAndPassword(
          auth,
          authForm.email,
          authForm.senha
        );
        await updateProfile(res.user, { displayName: authForm.nome });
        await setDoc(doc(db, "users", res.user.uid), {
          email: authForm.email,
          nome: authForm.nome,
          empresa: authForm.empresa,
          approved: false,
          role: "user",
          createdAt: serverTimestamp(),
        });
        await sendEmailVerification(res.user);
        showToast(
          "Conta criada! Verifique seu e-mail e aguarde aprovação.",
          "success"
        );
        setModoCadastro(false);
      } catch (e) {
        showToast(e.message, "error");
      }
    } else {
      if (!validarEmail(authForm.email)) {
        setAuthErrors({ email: "E-mail inválido" });
        return;
      }
      try {
        const res = await signInWithEmailAndPassword(
          auth,
          authForm.email,
          authForm.senha
        );
        if (!res.user.emailVerified)
          showToast("E-mail não verificado.", "error");
      } catch {
        showToast("E-mail ou senha incorretos.", "error");
      }
    }
  };

  const handleAprovarUsuario = async (uid, approved) => {
    try {
      await updateDoc(doc(db, "users", uid), { approved });
      showToast(approved ? "Aprovado!" : "Desativado.", "success");
      carregarUsuarios();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  const handleAlterarRole = async (uid, role) => {
    try {
      await updateDoc(doc(db, "users", uid), { role });
      showToast(`Role: ${role}`, "success");
      carregarUsuarios();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  const handleAddEmpresa = async () => {
    if (!novaEmpresa.trim()) return;
    try {
      await addDoc(collection(db, "empresas"), {
        nome: novaEmpresa.trim(),
        createdAt: serverTimestamp(),
      });
      showToast("Empresa adicionada!", "success");
      setNovaEmpresa("");
      carregarEmpresas();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  // ── LANÇAR ────────────────────────────────────────────────────────────────────
  const handleLancar = async () => {
    const erros = {};
    if (!form.lote.trim()) erros.lote = "Lote é obrigatório";
    if (!form.linha) erros.linha = "Selecione a linha do produto";
    if (!form.validade) erros.validade = "Validade é obrigatória";
    if (Object.keys(erros).length) {
      setFormErrors(erros);
      return;
    }
    setFormErrors({});
    setSalvando(true);
    try {
      const pasta = pastaDeLinhar(form.linha);
      const { ano, mes, chave } = getMesValidade(form.validade);
      const counterKey = `${chave}_${pasta.replace(/\s/g, "_")}`;

      // CORREÇÃO PRINCIPAL: referência criada ANTES da transação
      const novoDocRef = doc(collection(db, "retencoes"));

      const localGerado = await runTransaction(db, async (tx) => {
        const cRef = doc(db, "counters", counterKey);
        const cDoc = await tx.get(cRef);
        const novo = (cDoc.exists() ? cDoc.data().ultimo : 0) + 1;
        tx.set(cRef, { ultimo: novo });
        tx.set(novoDocRef, {
          lote: form.lote,
          linha: form.linha,
          pasta: pasta,
          descricao: form.descricao,
          validade: form.validade,
          ano,
          mes,
          chaveMes: chave,
          local: novo,
          status: calcularStatus(form.validade),
          usuario: user.displayName || user.email,
          usuarioId: user.uid,
          empresa: userData.empresa || "",
          createdAt: serverTimestamp(),
        });
        return novo;
      });

      await registrarHistorico(
        "LANÇAMENTO",
        `Pasta: ${pasta} | Linha: ${form.linha} | Lote: ${form.lote} | Local: ${localGerado} | Validade: ${form.validade}`
      );
      showToast(`Lançado em "${pasta}" — Local: ${localGerado}`, "success");
      setForm({ lote: "", linha: "", descricao: "", validade: "" });
      carregarDashboard();
      setPastaAtiva(pasta);
      setFiltros((f) => ({ ...f, ano: String(ano), mes }));
      setTela("tabela");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  // ── EDITAR ────────────────────────────────────────────────────────────────────
  const handleEditar = async () => {
    if (!editando) return;
    setSalvando(true);
    try {
      const novaPasta = pastaDeLinhar(editando.linha);
      const updates = {
        lote: editando.lote,
        linha: editando.linha,
        pasta: novaPasta,
        descricao: editando.descricao,
        validade: editando.validade,
      };
      if (editando.validade !== editando._validadeOriginal) {
        const { ano, mes, chave } = getMesValidade(editando.validade);
        Object.assign(updates, {
          ano,
          mes,
          chaveMes: chave,
          status: calcularStatus(editando.validade),
        });
      }
      await updateDoc(doc(db, "retencoes", editando.id), updates);
      await registrarHistorico(
        "EDIÇÃO",
        `Pasta: ${novaPasta} | Lote: ${editando.lote} | Local: ${editando.local}`
      );
      showToast("Registro atualizado.", "success");
      setModalAberto(false);
      setEditando(null);
      carregarDados();
      carregarDashboard();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  // ── EXCLUIR ───────────────────────────────────────────────────────────────────
  const handleExcluir = (item) => {
    setConfirm({
      message: `Excluir lote "${item.lote}" da pasta "${item.pasta}"?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deleteDoc(doc(db, "retencoes", item.id));
          await registrarHistorico(
            "EXCLUSÃO",
            `Pasta: ${item.pasta} | Lote: ${item.lote} | Local: ${item.local}`
          );
          showToast("Registro excluído.", "success");
          carregarDados();
          carregarDashboard();
        } catch (e) {
          showToast(e.message, "error");
        }
      },
      onCancel: () => setConfirm(null),
    });
  };

  // ── FILTROS E PAGINAÇÃO CLIENT-SIDE ──────────────────────────────────────────
  const listaFiltrada = useMemo(() => {
    let r = lista;
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase();
      r = r.filter(
        (i) =>
          i.lote?.toLowerCase().includes(q) ||
          i.linha?.toLowerCase().includes(q) ||
          i.descricao?.toLowerCase().includes(q) ||
          String(i.local).includes(q)
      );
    }
    return r;
  }, [lista, filtros.busca]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA)
  );
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const listaExibida = listaFiltrada.slice(
    (paginaSegura - 1) * ITENS_POR_PAGINA,
    paginaSegura * ITENS_POR_PAGINA
  );

  const anosDisp = useMemo(
    () => [...new Set(lista.map((i) => i.ano))].sort(),
    [lista]
  );
  const mesesDisp = useMemo(
    () =>
      [
        ...new Set(
          lista
            .filter(
              (i) => !filtros.ano || String(i.ano) === String(filtros.ano)
            )
            .map((i) => String(i.mes).padStart(2, "0"))
        ),
      ].sort(),
    [lista, filtros.ano]
  );

  // ────────────────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: dark ? "#0f172a" : "#f1f5f9",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #2563eb",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <span style={{ color: "#64748b", fontSize: 15 }}>
            Iniciando CQ Lab...
          </span>
        </div>
      </div>
    );

  if (!user)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: dark ? "#0f172a" : "#e2e8f0",
          padding: 16,
        }}
      >
        <div
          style={{
            background: dark ? "#1e293b" : "white",
            padding: 36,
            borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            width: "100%",
            maxWidth: 380,
            position: "relative",
          }}
        >
          <button
            onClick={() => setDark(!dark)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              position: "absolute",
              top: 16,
              right: 16,
              color: dark ? "#f8fafc" : "#475569",
              display: "flex",
              padding: 4,
            }}
          >
            {dark ? <IcoSun /> : <IcoMoon />}
          </button>
          <img
            src={logoEmpresa}
            alt="Logo"
            style={{ width: 100, display: "block", margin: "0 auto 28px" }}
          />
          {modoCadastro && (
            <h2
              style={{
                textAlign: "center",
                marginBottom: 20,
                color: dark ? "#f1f5f9" : "#1e293b",
                fontSize: 18,
              }}
            >
              Criar Conta
            </h2>
          )}
          {modoCadastro && (
            <>
              <Field label="Nome *" error={authErrors.nome}>
                <input
                  style={t.input}
                  placeholder="Seu nome"
                  value={authForm.nome}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, nome: e.target.value })
                  }
                />
              </Field>
              <Field label="Empresa *" error={authErrors.empresa}>
                <input
                  style={t.input}
                  placeholder="Nome da empresa"
                  value={authForm.empresa}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, empresa: e.target.value })
                  }
                  list="emp-list"
                />
                <datalist id="emp-list">
                  {empresasList.map((e) => (
                    <option key={e.id} value={e.nome} />
                  ))}
                </datalist>
              </Field>
            </>
          )}
          <Field label="E-mail *" error={authErrors.email}>
            <input
              style={t.input}
              placeholder="seu@email.com"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
            />
          </Field>
          <Field label="Senha *" error={authErrors.senha}>
            <input
              style={t.input}
              type="password"
              placeholder={modoCadastro ? "Mínimo 6 caracteres" : "Sua senha"}
              value={authForm.senha}
              onChange={(e) =>
                setAuthForm({ ...authForm, senha: e.target.value })
              }
            />
          </Field>
          {modoCadastro && (
            <Field label="Confirmar Senha *" error={authErrors.confirmarSenha}>
              <input
                style={t.input}
                type="password"
                placeholder="Repita a senha"
                value={authForm.confirmarSenha}
                onChange={(e) =>
                  setAuthForm({ ...authForm, confirmarSenha: e.target.value })
                }
              />
            </Field>
          )}
          <button style={t.btnPrimary} onClick={handleAuth}>
            {modoCadastro ? "Cadastrar" : "Entrar"}
          </button>
          <p
            style={{
              textAlign: "center",
              color: "#2563eb",
              cursor: "pointer",
              marginTop: 16,
              fontSize: 14,
            }}
            onClick={() => {
              setModoCadastro(!modoCadastro);
              setAuthErrors({});
            }}
          >
            {modoCadastro
              ? "Já tenho conta — Entrar"
              : "Não tenho conta — Cadastrar"}
          </p>
        </div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    );

  // ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        background: dark ? "#0f172a" : "#f1f5f9",
        overflow: "hidden",
      }}
    >
      {/* SIDEBAR */}
      <aside
        style={{
          width: sidebarAberta ? 230 : 0,
          flexShrink: 0,
          overflow: "hidden",
          background: dark ? "#1e293b" : "#0f172a",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: sidebarAberta ? "4px 0 16px rgba(0,0,0,0.2)" : "none",
        }}
      >
        <div
          style={{
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            height: "100%",
            minWidth: 230,
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 24,
              paddingBottom: 20,
              borderBottom: "1px solid #1e3a5f",
            }}
          >
            <img
              src={logoEmpresa}
              alt="Logo"
              style={{ width: 50, borderRadius: 10, marginBottom: 8 }}
            />
            <div
              style={{
                color: "#f8fafc",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 1.5,
              }}
            >
              CQ LAB
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
              {userData?.empresa}
            </div>
          </div>

          {[
            { id: "dashboard", label: "Dashboard", IcC: IcoHome },
            { id: "lancar", label: "Lançar", IcC: IcoPlus },
            {
              id: "tabela",
              label: "Arquivo",
              IcC: IcoFolder,
              badge: dashStats.vencido,
            },
            { id: "busca", label: "Busca Rápida", IcC: IcoSearch },
            { id: "historico", label: "Histórico", IcC: IcoHistory },
          ].map(({ id, label, IcC, badge }) => (
            <button
              key={id}
              onClick={() => setTela(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: tela === id ? "#2563eb" : "transparent",
                color: tela === id ? "white" : "#94a3b8",
                fontWeight: tela === id ? 600 : 400,
                fontSize: 13.5,
                transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <IcC />
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "white",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}

          {userData?.role === "admin" && (
            <>
              <div
                style={{ height: 1, background: "#1e3a5f", margin: "10px 0" }}
              />
              <button
                onClick={() => setTela("admin")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: tela === "admin" ? "#2563eb" : "transparent",
                  color: tela === "admin" ? "white" : "#94a3b8",
                  fontSize: 13.5,
                }}
              >
                <IcoUsers /> Administração
              </button>
            </>
          )}

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <button
              onClick={() => setDark(!dark)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: "transparent",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              {dark ? <IcoSun /> : <IcoMoon />}{" "}
              {dark ? "Tema Claro" : "Tema Escuro"}
            </button>
            <button
              onClick={() => signOut(auth)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                fontSize: 13,
              }}
            >
              <IcoLogout /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            background: dark ? "#1e293b" : "white",
            padding: "0 20px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSidebarAberta(!sidebarAberta)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: dark ? "#94a3b8" : "#64748b",
              display: "flex",
              padding: 6,
              borderRadius: 8,
            }}
          >
            {sidebarAberta ? <IcoClose size={20} /> : <IcoMenu size={20} />}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {userData?.role === "admin" && (
              <span
                style={{
                  fontSize: 11,
                  background: "#2563eb22",
                  color: "#2563eb",
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontWeight: 700,
                }}
              >
                ADMIN
              </span>
            )}
            <span style={{ color: dark ? "#cbd5e1" : "#475569", fontSize: 13 }}>
              <b style={{ color: dark ? "#f1f5f9" : "#1e293b" }}>
                {user.displayName || user.email}
              </b>
            </span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          {tela === "dashboard" && (
            <div>
              <h2 style={{ ...t.titulo, marginBottom: 20 }}>Dashboard</h2>
              {loadingDash ? (
                <Skeleton dark={dark} rows={3} />
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                      gap: 14,
                      marginBottom: 24,
                    }}
                  >
                    {[
                      {
                        label: "Total",
                        value: dashStats.total,
                        color: "#2563eb",
                      },
                      {
                        label: "Ativos",
                        value: dashStats.ativo,
                        color: "#10b981",
                      },
                      {
                        label: "Próximos",
                        value: dashStats.proximo,
                        color: "#f59e0b",
                      },
                      {
                        label: "Vencidos",
                        value: dashStats.vencido,
                        color: "#ef4444",
                      },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        style={{
                          background: dark ? "#1e293b" : "white",
                          borderRadius: 14,
                          padding: "18px 20px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                          borderLeft: `4px solid ${color}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: dark ? "#94a3b8" : "#64748b",
                            marginBottom: 4,
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 800, color }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ ...t.subtitulo, marginBottom: 12 }}>
                    Por Pasta / Linha
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                      gap: 12,
                      marginBottom: 24,
                    }}
                  >
                    {PASTAS.map((p) => {
                      const s = dashPorPasta[p] || {
                        total: 0,
                        ativo: 0,
                        proximo: 0,
                        vencido: 0,
                      };
                      const cor = COR_PASTA[p];
                      return (
                        <div
                          key={p}
                          style={{
                            background: dark ? "#1e293b" : "white",
                            borderRadius: 14,
                            padding: "16px 18px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                            borderTop: `3px solid ${cor}`,
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setPastaAtiva(p);
                            setTela("tabela");
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 10,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: cor,
                              }}
                            >
                              {p}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                background: `${cor}22`,
                                color: cor,
                                padding: "2px 8px",
                                borderRadius: 99,
                                fontWeight: 700,
                              }}
                            >
                              {s.total}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {[
                              { l: "✓", v: s.ativo, c: "#10b981" },
                              { l: "!", v: s.proximo, c: "#f59e0b" },
                              { l: "✗", v: s.vencido, c: "#ef4444" },
                            ].map((x) => (
                              <span
                                key={x.l}
                                style={{
                                  fontSize: 11,
                                  color: x.c,
                                  fontWeight: 700,
                                }}
                              >
                                {x.l} {x.v}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        windowWidth >= 900 ? "1fr 1fr" : "1fr",
                      gap: 16,
                      marginBottom: 24,
                    }}
                  >
                    <div
                      style={{
                        background: dark ? "#1e293b" : "white",
                        borderRadius: 14,
                        padding: "20px 24px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                      }}
                    >
                      <div style={{ ...t.subtitulo, marginBottom: 4 }}>
                        Lançamentos por Mês
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: dark ? "#64748b" : "#94a3b8",
                          marginBottom: 8,
                        }}
                      >
                        Últimos {dashChart.length} meses
                      </div>
                      {dashChart.length > 0 ? (
                        <BarChart dados={dashChart} dark={dark} />
                      ) : (
                        <div
                          style={{
                            height: 80,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#94a3b8",
                            fontSize: 13,
                          }}
                        >
                          Sem dados
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        background: dark ? "#1e293b" : "white",
                        borderRadius: 14,
                        padding: "20px 24px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                      }}
                    >
                      <div style={{ ...t.subtitulo, marginBottom: 16 }}>
                        Distribuição de Status
                      </div>
                      {dashStats.total > 0 && (
                        <>
                          <div
                            style={{
                              height: 10,
                              borderRadius: 99,
                              overflow: "hidden",
                              display: "flex",
                              marginBottom: 14,
                            }}
                          >
                            {[
                              { v: dashStats.ativo, c: "#10b981" },
                              { v: dashStats.proximo, c: "#f59e0b" },
                              { v: dashStats.vencido, c: "#ef4444" },
                            ].map(({ v, c }, i) => (
                              <div
                                key={i}
                                style={{
                                  flex: v,
                                  background: c,
                                  transition: "flex 0.4s ease",
                                }}
                              />
                            ))}
                          </div>
                          {[
                            {
                              label: "Ativos",
                              value: dashStats.ativo,
                              color: "#10b981",
                            },
                            {
                              label: "Próximos",
                              value: dashStats.proximo,
                              color: "#f59e0b",
                            },
                            {
                              label: "Vencidos",
                              value: dashStats.vencido,
                              color: "#ef4444",
                            },
                          ].map(({ label, value, color }) => (
                            <div
                              key={label}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <div
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    background: color,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: dark ? "#94a3b8" : "#64748b",
                                  }}
                                >
                                  {label}
                                </span>
                              </div>
                              <span
                                style={{ fontSize: 13, fontWeight: 700, color }}
                              >
                                {value} (
                                {dashStats.total > 0
                                  ? Math.round((value / dashStats.total) * 100)
                                  : 0}
                                %)
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      background: dark ? "#1e293b" : "white",
                      borderRadius: 14,
                      padding: "20px 24px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                    }}
                  >
                    <div style={{ ...t.subtitulo, marginBottom: 14 }}>
                      Últimos Lançamentos
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={t.table}>
                        <thead>
                          <tr
                            style={{ background: dark ? "#0f172a" : "#f8fafc" }}
                          >
                            {[
                              "Pasta",
                              "Linha",
                              "Local",
                              "Lote",
                              "Validade",
                              "Status",
                            ].map((h) => (
                              <th key={h} style={t.th}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dashRecentes.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                style={{
                                  textAlign: "center",
                                  padding: 20,
                                  color: "#94a3b8",
                                  fontSize: 13,
                                }}
                              >
                                Nenhum registro ainda.
                              </td>
                            </tr>
                          ) : (
                            dashRecentes.map((i) => {
                              const st = calcularStatus(i.validade);
                              const cp = COR_PASTA[i.pasta] || "#64748b";
                              return (
                                <tr key={i.id} style={t.tr}>
                                  <td style={t.td}>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: cp,
                                        background: `${cp}22`,
                                        padding: "2px 8px",
                                        borderRadius: 99,
                                      }}
                                    >
                                      {i.pasta}
                                    </span>
                                  </td>
                                  <td style={{ ...t.td, fontSize: 12 }}>
                                    {i.linha}
                                  </td>
                                  <td style={t.td}>{i.local}</td>
                                  <td style={{ ...t.td, fontWeight: 600 }}>
                                    {i.lote}
                                  </td>
                                  <td style={t.td}>{i.validade}</td>
                                  <td style={t.td}>
                                    <span
                                      style={{
                                        ...t.badge,
                                        color: getStatusColor(st),
                                        background: getStatusBg(st),
                                      }}
                                    >
                                      {st}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── LANÇAR ──────────────────────────────────────────────────────── */}
          {tela === "lancar" && (
            <div style={t.card}>
              <h2 style={{ ...t.titulo, marginBottom: 24 }}>Novo Lançamento</h2>

              <Field label="Linha / Produto *" error={formErrors.linha}>
                <select
                  style={t.input}
                  value={form.linha}
                  onChange={(e) => setForm({ ...form, linha: e.target.value })}
                >
                  <option value="">— Selecione a linha —</option>
                  {[
                    "Dynatint ALQ",
                    "Dynatint PMA",
                    "Colorantes",
                    "Dynatrend",
                  ].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  <optgroup label="Outros">
                    {[
                      "Dynaspers",
                      "Dynastamp",
                      "Dynaflex",
                      "Dynaseed",
                      "Dynafast",
                    ].map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>

              {form.linha && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: `${COR_PASTA[pastaDeLinhar(form.linha)]}18`,
                    borderLeft: `3px solid ${
                      COR_PASTA[pastaDeLinhar(form.linha)]
                    }`,
                    fontSize: 13,
                    color: COR_PASTA[pastaDeLinhar(form.linha)],
                    fontWeight: 600,
                  }}
                >
                  📁 Será lançado na pasta: <b>{pastaDeLinhar(form.linha)}</b>
                </div>
              )}

              <Field label="Lote *" error={formErrors.lote}>
                <input
                  style={t.input}
                  placeholder="Ex: LOT-2025-001"
                  value={form.lote}
                  onChange={(e) => setForm({ ...form, lote: e.target.value })}
                />
              </Field>

              <Field label="Descrição">
                <input
                  style={t.input}
                  placeholder="Observações adicionais..."
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                />
              </Field>

              <Field label="Data de Validade *" error={formErrors.validade}>
                <input
                  style={t.input}
                  type="date"
                  value={form.validade}
                  onChange={(e) =>
                    setForm({ ...form, validade: e.target.value })
                  }
                />
              </Field>

              <button
                style={{
                  ...t.btnPrimary,
                  opacity: salvando ? 0.6 : 1,
                  cursor: salvando ? "not-allowed" : "pointer",
                }}
                onClick={handleLancar}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Salvar Lançamento"}
              </button>
            </div>
          )}

          {/* ── ARQUIVO / TABELA ────────────────────────────────────────────── */}
          {tela === "tabela" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <h2 style={t.titulo}>Arquivo de Registros</h2>
                <button
                  onClick={() => exportarCSV(lista)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    background: dark ? "#1e293b" : "white",
                    border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
                    borderRadius: 9,
                    cursor: "pointer",
                    color: dark ? "#94a3b8" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <IcoDownload /> Exportar CSV
                </button>
              </div>

              {/* ABAS DE PASTA */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                {PASTAS.map((p) => {
                  const ativa = pastaAtiva === p;
                  const cor = COR_PASTA[p];
                  const stats = dashPorPasta[p] || { vencido: 0 };
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setPastaAtiva(p);
                        setPaginaAtual(1);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "9px 16px",
                        borderRadius: 10,
                        border: `2px solid ${
                          ativa ? cor : dark ? "#334155" : "#e2e8f0"
                        }`,
                        cursor: "pointer",
                        fontWeight: ativa ? 700 : 500,
                        fontSize: 13,
                        background: ativa
                          ? `${cor}18`
                          : dark
                          ? "#1e293b"
                          : "white",
                        color: ativa ? cor : dark ? "#94a3b8" : "#475569",
                        transition: "all 0.15s",
                      }}
                    >
                      <IcoFolder />
                      {p}
                      {stats.vencido > 0 && (
                        <span
                          style={{
                            background: "#ef4444",
                            color: "white",
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                          }}
                        >
                          {stats.vencido}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Indicador de pasta ativa */}
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: `${COR_PASTA[pastaAtiva]}14`,
                  borderLeft: `4px solid ${COR_PASTA[pastaAtiva]}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <IcoFolder />
                <span
                  style={{
                    fontWeight: 700,
                    color: COR_PASTA[pastaAtiva],
                    fontSize: 14,
                  }}
                >
                  Pasta: {pastaAtiva}
                </span>
                {pastaAtiva === "Outros" && (
                  <span
                    style={{
                      fontSize: 12,
                      color: dark ? "#64748b" : "#94a3b8",
                    }}
                  >
                    — Dynaspers, Dynastamp, Dynaflex, Dynaseed, Dynafast
                  </span>
                )}
              </div>

              <div
                style={{
                  background: dark ? "#1e293b" : "white",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                }}
              >
                {erroDados && (
                  <p
                    style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}
                  >
                    {erroDados}
                  </p>
                )}

                {/* Filtros */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 16,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        display: "flex",
                      }}
                    >
                      <IcoSearch />
                    </span>
                    <input
                      style={{ ...t.input, paddingLeft: 36, marginBottom: 0 }}
                      placeholder="Buscar lote, linha..."
                      value={filtros.busca}
                      onChange={(e) =>
                        setFiltros((f) => ({ ...f, busca: e.target.value }))
                      }
                    />
                  </div>
                  <select
                    style={{ ...t.input, maxWidth: 130, marginBottom: 0 }}
                    value={filtros.ano}
                    onChange={(e) =>
                      setFiltros((f) => ({
                        ...f,
                        ano: e.target.value,
                        mes: "",
                      }))
                    }
                  >
                    <option value="">Todos os Anos</option>
                    {anosDisp.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <select
                    style={{ ...t.input, maxWidth: 130, marginBottom: 0 }}
                    value={filtros.mes}
                    onChange={(e) =>
                      setFiltros((f) => ({ ...f, mes: e.target.value }))
                    }
                  >
                    <option value="">Todos os Meses</option>
                    {mesesDisp.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {userData?.role === "admin" && (
                    <>
                      <select
                        style={{ ...t.input, maxWidth: 160, marginBottom: 0 }}
                        value={filtros.empresa}
                        onChange={(e) =>
                          setFiltros((f) => ({ ...f, empresa: e.target.value }))
                        }
                      >
                        <option value="">Todas Empresas</option>
                        {empresasList.map((e) => (
                          <option key={e.id} value={e.nome}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                      <select
                        style={{ ...t.input, maxWidth: 160, marginBottom: 0 }}
                        value={filtros.usuario}
                        onChange={(e) =>
                          setFiltros((f) => ({ ...f, usuario: e.target.value }))
                        }
                      >
                        <option value="">Todos Usuários</option>
                        {usersList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nome}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      color: dark ? "#64748b" : "#94a3b8",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {loadingTabela
                      ? "Carregando..."
                      : `${listaFiltrada.length} registro(s)`}
                  </span>
                </div>

                {/* Tabela */}
                <div style={{ overflowX: "auto" }}>
                  {loadingTabela ? (
                    <Skeleton dark={dark} />
                  ) : (
                    <table style={t.table}>
                      <thead>
                        <tr
                          style={{ background: dark ? "#0f172a" : "#f8fafc" }}
                        >
                          {[
                            "Local",
                            "Linha",
                            "Lote",
                            "Descrição",
                            "Validade",
                            "Status",
                            "Ações",
                          ].map((h) => (
                            <th key={h} style={t.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {listaExibida.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                textAlign: "center",
                                padding: 32,
                                color: "#94a3b8",
                              }}
                            >
                              Nenhum registro encontrado nesta pasta.
                            </td>
                          </tr>
                        ) : (
                          listaExibida.map((i) => {
                            const st = calcularStatus(i.validade);
                            return (
                              <tr
                                key={i.id}
                                style={{
                                  ...t.tr,
                                  transition: "background 0.1s",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = dark
                                    ? "#0f172a"
                                    : "#f8fafc")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background =
                                    "transparent")
                                }
                              >
                                <td
                                  style={{
                                    ...t.td,
                                    fontWeight: 700,
                                    color: COR_PASTA[pastaAtiva],
                                  }}
                                >
                                  {i.local}
                                </td>
                                <td style={{ ...t.td, fontSize: 12 }}>
                                  <span
                                    style={{
                                      background: `${COR_PASTA[pastaAtiva]}18`,
                                      color: COR_PASTA[pastaAtiva],
                                      padding: "2px 8px",
                                      borderRadius: 99,
                                      fontWeight: 600,
                                      fontSize: 11,
                                    }}
                                  >
                                    {i.linha}
                                  </span>
                                </td>
                                <td style={{ ...t.td, fontWeight: 600 }}>
                                  {i.lote}
                                </td>
                                <td
                                  style={{
                                    ...t.td,
                                    color: dark ? "#94a3b8" : "#64748b",
                                  }}
                                >
                                  {i.descricao || "—"}
                                </td>
                                <td style={t.td}>{i.validade}</td>
                                <td style={t.td}>
                                  <span
                                    style={{
                                      ...t.badge,
                                      color: getStatusColor(st),
                                      background: getStatusBg(st),
                                    }}
                                  >
                                    {st}
                                  </span>
                                </td>
                                <td style={{ ...t.td, whiteSpace: "nowrap" }}>
                                  <button
                                    title="Editar"
                                    onClick={() => {
                                      setEditando({
                                        ...i,
                                        _validadeOriginal: i.validade,
                                      });
                                      setModalAberto(true);
                                    }}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#2563eb",
                                      padding: 5,
                                      borderRadius: 6,
                                      display: "inline-flex",
                                    }}
                                  >
                                    <IcoEdit />
                                  </button>
                                  <button
                                    title="Excluir"
                                    onClick={() => handleExcluir(i)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#ef4444",
                                      padding: 5,
                                      borderRadius: 6,
                                      display: "inline-flex",
                                    }}
                                  >
                                    <IcoTrash />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Paginação client-side */}
                {totalPaginas > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                      disabled={paginaSegura === 1}
                      style={{
                        ...t.btnPag,
                        opacity: paginaSegura === 1 ? 0.4 : 1,
                      }}
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPaginas ||
                          Math.abs(p - paginaSegura) <= 1
                      )
                      .reduce((acc, p, i, arr) => {
                        if (i > 0 && arr[i - 1] !== p - 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "..." ? (
                          <span
                            key={`e${i}`}
                            style={{ color: dark ? "#64748b" : "#94a3b8" }}
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPaginaAtual(p)}
                            style={{
                              ...t.btnPag,
                              minWidth: 36,
                              background:
                                paginaSegura === p
                                  ? "#2563eb"
                                  : dark
                                  ? "#0f172a"
                                  : "white",
                              color:
                                paginaSegura === p
                                  ? "white"
                                  : dark
                                  ? "#94a3b8"
                                  : "#475569",
                              fontWeight: paginaSegura === p ? 700 : 400,
                            }}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      onClick={() =>
                        setPaginaAtual((p) => Math.min(totalPaginas, p + 1))
                      }
                      disabled={paginaSegura === totalPaginas}
                      style={{
                        ...t.btnPag,
                        opacity: paginaSegura === totalPaginas ? 0.4 : 1,
                      }}
                    >
                      ›
                    </button>
                    <span
                      style={{
                        fontSize: 12,
                        color: dark ? "#64748b" : "#94a3b8",
                      }}
                    >
                      Página {paginaSegura} de {totalPaginas}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BUSCA ───────────────────────────────────────────────────────── */}
          {tela === "busca" && (
            <div style={t.card}>
              <h2 style={{ ...t.titulo, marginBottom: 24 }}>
                Busca Rápida por Lote
              </h2>
              <Field label="Número do Lote">
                <input
                  style={t.input}
                  placeholder="Ex: LOT-2025-001"
                  value={loteBusca}
                  onChange={(e) => {
                    setLoteBusca(e.target.value);
                    setResultadoBusca(null);
                  }}
                />
              </Field>
              <button
                style={{
                  ...t.btnPrimary,
                  opacity: buscando ? 0.6 : 1,
                  cursor: buscando ? "not-allowed" : "pointer",
                }}
                disabled={buscando}
                onClick={async () => {
                  if (!loteBusca.trim()) {
                    showToast("Digite um lote.", "error");
                    return;
                  }
                  setBuscando(true);
                  try {
                    const cs = [where("lote", "==", loteBusca.trim())];
                    if (userData.role !== "admin" && userData.empresa)
                      cs.push(where("empresa", "==", userData.empresa));
                    const snap = await getDocs(
                      query(collection(db, "retencoes"), ...cs)
                    );
                    setResultadoBusca(
                      !snap.empty
                        ? {
                            found: true,
                            data: snap.docs.map((d) => ({
                              id: d.id,
                              ...d.data(),
                            })),
                          }
                        : { found: false }
                    );
                  } catch {
                    showToast("Erro ao buscar.", "error");
                  } finally {
                    setBuscando(false);
                  }
                }}
              >
                {buscando ? "Buscando..." : "Localizar"}
              </button>

              {resultadoBusca && !resultadoBusca.found && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.08)",
                    color: "#ef4444",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  ❌ Lote não encontrado.
                </div>
              )}
              {resultadoBusca?.found && (
                <div style={{ marginTop: 16 }}>
                  {resultadoBusca.data.map((item) => {
                    const st = calcularStatus(item.validade);
                    const cp = COR_PASTA[item.pasta] || "#64748b";
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          background: dark ? "#0f172a" : "#f8fafc",
                          marginBottom: 10,
                          borderLeft: `4px solid ${cp}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 10,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontWeight: 700,
                                color: dark ? "#f1f5f9" : "#1e293b",
                                fontSize: 15,
                              }}
                            >
                              Lote: {item.lote}
                            </span>
                            <div style={{ fontSize: 11, marginTop: 3 }}>
                              <span
                                style={{
                                  background: `${cp}22`,
                                  color: cp,
                                  padding: "2px 8px",
                                  borderRadius: 99,
                                  fontWeight: 700,
                                  marginRight: 6,
                                }}
                              >
                                {item.pasta}
                              </span>
                              <span
                                style={{ color: dark ? "#94a3b8" : "#64748b" }}
                              >
                                {item.linha}
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              ...t.badge,
                              color: getStatusColor(st),
                              background: getStatusBg(st),
                            }}
                          >
                            {st}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(130px,1fr))",
                            gap: 8,
                          }}
                        >
                          {[
                            ["Local", item.local],
                            ["Mês/Ano", `${item.mes}/${item.ano}`],
                            ["Validade", item.validade],
                            ["Empresa", item.empresa],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: dark ? "#64748b" : "#94a3b8",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 14,
                                  color: dark ? "#cbd5e1" : "#334155",
                                  fontWeight: 500,
                                }}
                              >
                                {v || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── HISTÓRICO ───────────────────────────────────────────────────── */}
          {tela === "historico" && (
            <div>
              <h2 style={{ ...t.titulo, marginBottom: 20 }}>
                Histórico de Ações
              </h2>
              <div
                style={{
                  background: dark ? "#1e293b" : "white",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                }}
              >
                {userData?.role === "admin" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      style={{ ...t.input, maxWidth: 180, marginBottom: 0 }}
                      value={filtros.empresa}
                      onChange={(e) =>
                        setFiltros((f) => ({
                          ...f,
                          empresa: e.target.value,
                          usuario: "",
                        }))
                      }
                    >
                      <option value="">Todas Empresas</option>
                      {empresasList.map((e) => (
                        <option key={e.id} value={e.nome}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                    <select
                      style={{ ...t.input, maxWidth: 180, marginBottom: 0 }}
                      value={filtros.usuario}
                      onChange={(e) =>
                        setFiltros((f) => ({ ...f, usuario: e.target.value }))
                      }
                    >
                      <option value="">Todos Usuários</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ overflowX: "auto" }}>
                  {loadingHistorico ? (
                    <Skeleton dark={dark} />
                  ) : (
                    <table style={t.table}>
                      <thead>
                        <tr
                          style={{ background: dark ? "#0f172a" : "#f8fafc" }}
                        >
                          {[
                            "Ação",
                            "Detalhe",
                            "Usuário",
                            "Empresa",
                            "Data/Hora",
                          ].map((h) => (
                            <th key={h} style={t.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {historico.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              style={{
                                textAlign: "center",
                                padding: 28,
                                color: "#94a3b8",
                              }}
                            >
                              Nenhuma ação registrada.
                            </td>
                          </tr>
                        ) : (
                          historico.map((h) => {
                            const c =
                              h.acao === "EXCLUSÃO"
                                ? "#ef4444"
                                : h.acao === "EDIÇÃO"
                                ? "#f59e0b"
                                : "#10b981";
                            return (
                              <tr key={h.id} style={t.tr}>
                                <td style={t.td}>
                                  <span
                                    style={{
                                      ...t.badge,
                                      color: c,
                                      background: c + "22",
                                    }}
                                  >
                                    {h.acao}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...t.td,
                                    fontSize: 12,
                                    maxWidth: 240,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {h.detalhe}
                                </td>
                                <td style={t.td}>{h.usuario}</td>
                                <td style={t.td}>{h.empresa || "—"}</td>
                                <td
                                  style={{
                                    ...t.td,
                                    fontSize: 12,
                                    color: dark ? "#64748b" : "#94a3b8",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {h.createdAt?.toDate
                                    ? h.createdAt
                                        .toDate()
                                        .toLocaleString("pt-BR")
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ADMINISTRAÇÃO ───────────────────────────────────────────────── */}
          {tela === "admin" && userData?.role === "admin" && (
            <div>
              <h2 style={{ ...t.titulo, marginBottom: 20 }}>Administração</h2>
              <div
                style={{
                  background: dark ? "#1e293b" : "white",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                  marginBottom: 16,
                }}
              >
                <div style={{ ...t.subtitulo, marginBottom: 14 }}>
                  Empresas Cadastradas
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input
                    style={{ ...t.input, flex: 1, marginBottom: 0 }}
                    placeholder="Nova empresa"
                    value={novaEmpresa}
                    onChange={(e) => setNovaEmpresa(e.target.value)}
                  />
                  <button
                    onClick={handleAddEmpresa}
                    style={{
                      padding: "11px 20px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: 9,
                      cursor: "pointer",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Adicionar
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {empresasList.map((e) => (
                    <span
                      key={e.id}
                      style={{
                        padding: "5px 14px",
                        background: dark ? "#0f172a" : "#f1f5f9",
                        borderRadius: 99,
                        fontSize: 13,
                        color: dark ? "#94a3b8" : "#475569",
                      }}
                    >
                      {e.nome}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: dark ? "#1e293b" : "white",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                }}
              >
                <div style={{ ...t.subtitulo, marginBottom: 14 }}>
                  Usuários Cadastrados
                </div>
                {loadingUsers ? (
                  <Skeleton dark={dark} rows={3} />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={t.table}>
                      <thead>
                        <tr
                          style={{ background: dark ? "#0f172a" : "#f8fafc" }}
                        >
                          {[
                            "Nome",
                            "E-mail",
                            "Empresa",
                            "Role",
                            "Status",
                            "Ações",
                          ].map((h) => (
                            <th key={h} style={t.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map((u) => (
                          <tr key={u.id} style={t.tr}>
                            <td style={{ ...t.td, fontWeight: 600 }}>
                              {u.nome}
                            </td>
                            <td style={{ ...t.td, fontSize: 12 }}>{u.email}</td>
                            <td style={t.td}>{u.empresa}</td>
                            <td style={t.td}>
                              <select
                                value={u.role || "user"}
                                onChange={(e) =>
                                  handleAlterarRole(u.id, e.target.value)
                                }
                                style={{
                                  background: dark ? "#0f172a" : "#f8fafc",
                                  color: dark ? "#f1f5f9" : "#1e293b",
                                  border: `1px solid ${
                                    dark ? "#334155" : "#e2e8f0"
                                  }`,
                                  borderRadius: 6,
                                  padding: "3px 8px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                            <td style={t.td}>
                              <span
                                style={{
                                  ...t.badge,
                                  background: u.approved
                                    ? "#10b98122"
                                    : "#ef444422",
                                  color: u.approved ? "#10b981" : "#ef4444",
                                }}
                              >
                                {u.approved ? "Aprovado" : "Pendente"}
                              </span>
                            </td>
                            <td style={t.td}>
                              {u.approved ? (
                                <button
                                  onClick={() =>
                                    handleAprovarUsuario(u.id, false)
                                  }
                                  style={{
                                    background: "#ef444422",
                                    color: "#ef4444",
                                    border: "none",
                                    padding: "5px 12px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  Desativar
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleAprovarUsuario(u.id, true)
                                  }
                                  style={{
                                    background: "#10b98122",
                                    color: "#10b981",
                                    border: "none",
                                    padding: "5px 12px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  Aprovar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL EDIÇÃO */}
      {modalAberto && editando && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalAberto(false);
              setEditando(null);
            }
          }}
        >
          <div
            style={{
              background: dark ? "#1e293b" : "white",
              padding: 28,
              borderRadius: 16,
              width: 420,
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h3 style={{ ...t.titulo, marginBottom: 20 }}>Editar Registro</h3>

            <Field label="Linha / Produto">
              <select
                style={t.input}
                value={editando.linha || ""}
                onChange={(e) =>
                  setEditando({ ...editando, linha: e.target.value })
                }
              >
                <option value="">— Selecione —</option>
                {[
                  "Dynatint ALQ",
                  "Dynatint PMA",
                  "Colorantes",
                  "Dynatrend",
                ].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
                <optgroup label="Outros">
                  {[
                    "Dynaspers",
                    "Dynastamp",
                    "Dynaflex",
                    "Dynaseed",
                    "Dynafast",
                  ].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>

            {editando.linha && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: `${COR_PASTA[pastaDeLinhar(editando.linha)]}18`,
                  fontSize: 12,
                  color: COR_PASTA[pastaDeLinhar(editando.linha)],
                  fontWeight: 600,
                }}
              >
                📁 Pasta: {pastaDeLinhar(editando.linha)}
              </div>
            )}

            <Field label="Lote">
              <input
                style={t.input}
                value={editando.lote}
                onChange={(e) =>
                  setEditando({ ...editando, lote: e.target.value })
                }
              />
            </Field>
            <Field label="Descrição">
              <input
                style={t.input}
                value={editando.descricao || ""}
                onChange={(e) =>
                  setEditando({ ...editando, descricao: e.target.value })
                }
              />
            </Field>
            <Field label="Validade">
              <input
                style={t.input}
                type="date"
                value={editando.validade}
                onChange={(e) =>
                  setEditando({ ...editando, validade: e.target.value })
                }
              />
            </Field>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ ...t.btnPrimary, opacity: salvando ? 0.6 : 1 }}
                onClick={handleEditar}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => {
                  setModalAberto(false);
                  setEditando(null);
                }}
                style={{
                  ...t.btnPrimary,
                  background: dark ? "#334155" : "#e2e8f0",
                  color: dark ? "#f1f5f9" : "#475569",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {confirm && <ConfirmModal {...confirm} dark={dark} />}
    </div>
  );
}

// ─── TEMA ─────────────────────────────────────────────────────────────────────
const tema = (dark) => ({
  input: {
    width: "100%",
    padding: "10px 14px",
    marginBottom: 14,
    borderRadius: 8,
    border: `1.5px solid ${dark ? "#334155" : "#e2e8f0"}`,
    background: dark ? "#0f172a" : "#f8fafc",
    color: dark ? "#f1f5f9" : "#1e293b",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.15s",
  },
  btnPrimary: {
    width: "100%",
    padding: "11px 0",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  btnPag: {
    padding: "6px 12px",
    borderRadius: 7,
    border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
    background: dark ? "#1e293b" : "white",
    color: dark ? "#94a3b8" : "#475569",
    cursor: "pointer",
    fontSize: 13,
  },
  card: {
    background: dark ? "#1e293b" : "white",
    padding: 28,
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
    maxWidth: 600,
    margin: "0 auto",
  },
  titulo: {
    color: dark ? "#f1f5f9" : "#1e293b",
    fontWeight: 800,
    fontSize: 20,
    margin: 0,
  },
  subtitulo: {
    color: dark ? "#cbd5e1" : "#334155",
    fontWeight: 700,
    fontSize: 15,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: dark ? "#94a3b8" : "#475569",
    marginBottom: 5,
  },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 480 },
  th: {
    padding: "9px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: dark ? "#64748b" : "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    borderBottom: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
  },
  tr: { borderBottom: `1px solid ${dark ? "#1e293b66" : "#f1f5f9"}` },
  td: {
    padding: "11px 14px",
    fontSize: 13.5,
    color: dark ? "#cbd5e1" : "#334155",
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 99,
    display: "inline-block",
    letterSpacing: 0.3,
  },
});
