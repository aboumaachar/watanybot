import { useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType, type SVGProps } from "react";
import {
  AddCircle24Regular,
  Megaphone24Regular,
  Mic24Regular,
  Share24Regular,
  ArrowCircleRight24Regular,
  Video24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { useLocation } from "react-router-dom";
import { ReliableWebSocketClient, type ReliableWebSocketState } from "@watany/shared/reliable-websocket";
import { VoiceMode } from "../components/VoiceMode";
import { getDefaultApiWebSocketUrl } from "../lib/api-base";

type ChannelMode = "direct" | "relay";
type StreamMode = "meeting" | "broadcast" | "indirect";
type LiveRole = "host" | "participant" | "viewer";
type Workflow = "host" | "join";
type ConnectionState = "idle" | "connecting" | "connected";

type MediaSession = {
  id: string;
  code: string;
  roomSlug: string;
  title: string;
  audience: string;
  mode: ChannelMode;
  preset: StreamMode;
  createdAt: number;
  viewerUrl: string;
  relayUrl: string;
  ingestKey: string;
};

const STORAGE_KEY = "watany_media_sessions";

type Preset = {
  id: StreamMode;
  title: string;
  desc: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: string;
};

type PeerSummary = {
  peerId: string;
  role: LiveRole;
  displayName: string;
};

type RemotePeer = PeerSummary & {
  stream: MediaStream | null;
};

type SignalEnvelope = {
  type: "signal";
  roomId: string;
  fromPeerId: string;
  signalType: "offer" | "answer" | "ice-candidate";
  payload: unknown;
};

const PRESETS: Preset[] = [
  {
    id: "meeting",
    title: "اجتماع فيديو مباشر",
    desc: "غرفة خاصة للدعم المباشر أو المتابعة الفردية مع بث ثنائي الاتجاه.",
    icon: Video24Regular,
    accent: "#0F766E",
  },
  {
    id: "broadcast",
    title: "بث مباشر للجمهور",
    desc: "إرسال فيديو وصوت إلى قناة عامة أو فئة محددة مع رابط مشاهدة فوري.",
    icon: Megaphone24Regular,
    accent: "#C2410C",
  },
  {
    id: "indirect",
    title: "قناة غير مباشرة",
    desc: "تهيئة بث وسيط عبر مشرف أو نقطة تحويل مع مراقبة المشاركة والحقوق.",
    icon: Share24Regular,
    accent: "#4338CA",
  },
];

function buildAppUrl(pathname: string): URL {
  const baseUrl = globalThis.window === undefined
    ? new URL(import.meta.env.BASE_URL, "https://watanybot.local")
    : new URL(import.meta.env.BASE_URL, globalThis.window.location.origin);

  return new URL(pathname.replace(/^\//, ""), baseUrl);
}

function getLiveRoleLabel(role: LiveRole) {
  switch (role) {
    case "host":
      return "المضيف";
    case "participant":
      return "مشارك مباشر";
    default:
      return "مشاهد";
  }
}

function readRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readRecordNumber(record: Record<string, unknown>, key: string, fallback = 0) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getConnectionLabel(state: ConnectionState) {
  if (state === "connected") return "متصل";
  if (state === "connecting") return "جارٍ الاتصال";
  return "غير متصل";
}

function getLiveRoleSummary(role: LiveRole) {
  if (role === "host") return "المضيف";
  if (role === "participant") return "مشارك مباشر";
  return "مشاهد";
}

function getMediaAccentStyle(accent: string): CSSProperties & { "--media-accent": string } {
  return { "--media-accent": accent };
}

export default function MediaCenterPage() {
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<ReliableWebSocketClient | null>(null);
  const roomIdRef = useRef("");
  const peerIdRef = useRef("");
  const roleRef = useRef<LiveRole>("viewer");
  const activeSessionRef = useRef<MediaSession | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const remotePeerSummariesRef = useRef(new Map<string, PeerSummary>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const remoteVideoElementsRef = useRef(new Map<string, HTMLVideoElement>());
  const manualDisconnectRef = useRef(false);
  const [preset, setPreset] = useState<StreamMode>("meeting");
  const [channelMode, setChannelMode] = useState<ChannelMode>("direct");
  const [roomName, setRoomName] = useState("غرفة متابعة المعاملات");
  const [audience, setAudience] = useState("المحاربون القدامى");
  const [withCamera, setWithCamera] = useState(true);
  const [withMic, setWithMic] = useState(true);
  const [shareScreen, setShareScreen] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [liveRole, setLiveRole] = useState<LiveRole>("viewer");
  const [peerCount, setPeerCount] = useState(0);
  const [hostPeerId, setHostPeerId] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>("host");

  const activePreset = useMemo(() => PRESETS.find((item) => item.id === preset) ?? PRESETS[0], [preset]);
  const mediaWsUrl = useMemo(() => getDefaultApiWebSocketUrl("/ws/media"), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSessions(JSON.parse(raw) as MediaSession[]);
      }
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code") || "";
    const room = params.get("room") || "";
    const mode = params.get("mode");
    const voice = params.get("voice");
    if (code) setJoinCode(code);
    if (room) setRoomName(room.replace(/-/g, " "));
    if (mode === "direct" || mode === "relay") setChannelMode(mode);
    if (voice === "1") setVoiceModeOpen(true);
    if (code && room) {
      setWorkflow("join");
      setSessionCode(code.toUpperCase());
      setInviteLink(buildSessionLink(room, code.toUpperCase(), mode === "relay" ? "relay" : "direct"));
    }
  }, [location.search]);

  useEffect(() => {
    return () => {
      disconnectLiveRoom(true);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [shareScreen, withCamera, withMic]);

  useEffect(() => {
    for (const peer of remotePeers) {
      const element = remoteVideoElementsRef.current.get(peer.peerId);
      if (element && element.srcObject !== peer.stream) {
        element.srcObject = peer.stream;
      }
    }
  }, [remotePeers]);

  function persistSessions(next: MediaSession[]) {
    setSessions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function buildRoomId(session: MediaSession) {
    return `${session.roomSlug}-${session.code.toLowerCase()}`;
  }

  function buildSessionLink(roomSlug: string, code: string, mode: ChannelMode) {
    const url = buildAppUrl("/media");
    url.searchParams.set("room", roomSlug);
    url.searchParams.set("code", code);
    url.searchParams.set("mode", mode);
    return url.toString();
  }

  function createSessionRecord() {
    const slug = Math.random().toString(36).slice(2, 8).toUpperCase();
    const roomSlug = roomName.trim().replace(/\s+/g, "-").toLowerCase() || "watany-live";
    const viewerUrl = buildSessionLink(roomSlug, slug, channelMode);

    return {
      id: `${Date.now()}-${slug}`,
      code: slug,
      roomSlug,
      title: roomName.trim() || "غرفة موطني المباشرة",
      audience,
      mode: channelMode,
      preset,
      createdAt: Date.now(),
      viewerUrl,
      relayUrl: buildAppUrl(`/media/relay/${roomSlug}`).toString(),
      ingestKey: `${roomSlug}_${slug}`,
    } satisfies MediaSession;
  }

  function upsertRemotePeer(peer: PeerSummary, stream: MediaStream | null = null) {
    remotePeerSummariesRef.current.set(peer.peerId, peer);
    setRemotePeers((current) => {
      const existing = current.find((item) => item.peerId === peer.peerId);
      if (existing) {
        return current.map((item) => item.peerId === peer.peerId ? { ...item, ...peer, stream: stream ?? item.stream } : item);
      }

      return [...current, { ...peer, stream }];
    });
  }

  function removeRemotePeer(peerId: string) {
    const peerConnection = peerConnectionsRef.current.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(peerId);
    }

    remoteStreamsRef.current.delete(peerId);
    remotePeerSummariesRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    remoteVideoElementsRef.current.delete(peerId);
    setRemotePeers((current) => current.filter((peer) => peer.peerId !== peerId));
  }

  async function ensurePreviewStream(needsLocalMedia: boolean) {
    if (!needsLocalMedia) {
      return true;
    }

    if (streamRef.current) {
      return true;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: withCamera,
        audio: withMic,
      });
      streamRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
      return true;
    } catch {
      setError("تعذر تجهيز الميكروفون أو الكاميرا لبدء الجلسة الحية.");
      setStatus("");
      return false;
    }
  }

  function getSessionByCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return sessions.find((session) => session.code === normalized) ?? null;
  }

  function getActiveSession() {
    const stored = sessionCode ? getSessionByCode(sessionCode) : null;
    if (stored) {
      return stored;
    }

    if (!sessionCode) {
      return null;
    }

    const roomSlug = roomName.trim().replace(/\s+/g, "-").toLowerCase() || "watany-live";
    return {
      id: `live-${sessionCode}`,
      code: sessionCode,
      roomSlug,
      title: roomName.trim() || "غرفة موطني المباشرة",
      audience,
      mode: channelMode,
      preset,
      createdAt: Date.now(),
      viewerUrl: inviteLink || buildSessionLink(roomSlug, sessionCode, channelMode),
      relayUrl: buildAppUrl(`/media/relay/${roomSlug}`).toString(),
      ingestKey: `${roomSlug}_${sessionCode}`,
    } satisfies MediaSession;
  }

  function sendSignalMessage(payload: unknown) {
    if (!wsRef.current) {
      return;
    }

    wsRef.current.sendJSON(payload);
  }

  function resetRemoteState() {
    for (const peerConnection of peerConnectionsRef.current.values()) {
      peerConnection.close();
    }

    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    remotePeerSummariesRef.current.clear();
    pendingCandidatesRef.current.clear();
    remoteVideoElementsRef.current.clear();
    setRemotePeers([]);
    setPeerCount(0);
    setHostPeerId("");
  }

  function shouldInitiatePeer(localRole: LiveRole, mode: ChannelMode, localPeerId: string, remotePeer: PeerSummary) {
    if (mode === "relay") {
      return localRole === "host";
    }

    if (localRole === "viewer" || remotePeer.role === "viewer") {
      return false;
    }

    return localPeerId.localeCompare(remotePeer.peerId) > 0;
  }

  async function flushPendingCandidates(peerId: string, peerConnection: RTCPeerConnection) {
    const pending = pendingCandidatesRef.current.get(peerId) || [];
    if (pending.length === 0) {
      return;
    }

    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of pending) {
      await peerConnection.addIceCandidate(candidate);
    }
  }

  async function createPeerConnection(peer: PeerSummary, initiateOffer: boolean) {
    const existing = peerConnectionsRef.current.get(peer.peerId);
    if (existing) {
      return existing;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnectionsRef.current.set(peer.peerId, peerConnection);

    if (roleRef.current !== "viewer" && streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        peerConnection.addTrack(track, streamRef.current);
      }
    }

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !roomIdRef.current) {
        return;
      }

      sendSignalMessage({
        type: "signal",
        roomId: roomIdRef.current,
        targetPeerId: peer.peerId,
        signalType: "ice-candidate",
        payload: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      remoteStreamsRef.current.set(peer.peerId, stream);
      upsertRemotePeer(peer, stream);
    };

    peerConnection.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(peerConnection.connectionState)) {
        removeRemotePeer(peer.peerId);
      }
    };

    if (initiateOffer) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendSignalMessage({
        type: "signal",
        roomId: roomIdRef.current,
        targetPeerId: peer.peerId,
        signalType: "offer",
        payload: offer,
      });
    }

    return peerConnection;
  }

  async function handleSignalMessage(message: SignalEnvelope) {
    const remotePeer = remotePeerSummariesRef.current.get(message.fromPeerId) ?? {
      peerId: message.fromPeerId,
      role: "participant" as LiveRole,
      displayName: "مشارك",
    };

    if (message.signalType === "offer") {
      const peerConnection = await createPeerConnection(remotePeer, false);
      await peerConnection.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
      await flushPendingCandidates(message.fromPeerId, peerConnection);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSignalMessage({
        type: "signal",
        roomId: message.roomId,
        targetPeerId: message.fromPeerId,
        signalType: "answer",
        payload: answer,
      });
      return;
    }

    if (message.signalType === "answer") {
      const peerConnection = peerConnectionsRef.current.get(message.fromPeerId);
      if (!peerConnection) {
        return;
      }

      await peerConnection.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
      await flushPendingCandidates(message.fromPeerId, peerConnection);
      return;
    }

    if (message.signalType === "ice-candidate") {
      const peerConnection = peerConnectionsRef.current.get(message.fromPeerId);
      const candidate = message.payload as RTCIceCandidateInit;
      if (!peerConnection?.remoteDescription) {
        const queue = pendingCandidatesRef.current.get(message.fromPeerId) || [];
        queue.push(candidate);
        pendingCandidatesRef.current.set(message.fromPeerId, queue);
        return;
      }

      await peerConnection.addIceCandidate(candidate);
    }
  }

  function disconnectLiveRoom(silent = false) {
    manualDisconnectRef.current = true;
    activeSessionRef.current = null;

    if (wsRef.current?.isOpen() && roomIdRef.current) {
      wsRef.current.sendJSON({ type: "leave", roomId: roomIdRef.current });
    }

    wsRef.current?.disconnect();
    wsRef.current = null;
    roomIdRef.current = "";
    peerIdRef.current = "";
    resetRemoteState();
    setConnectionState("idle");

    if (!silent) {
      setStatus("تم إنهاء الاتصال الحي.");
      setError("");
    }
  }

  async function connectToRoom(role: LiveRole, session: MediaSession) {
    if (!mediaWsUrl) {
      setError("البث المباشر غير مهيأ على هذا المسار العام حالياً. اضبط VITE_WS_URL أو فعّل وكيل websocket عام لهذا النشر.");
      setStatus("");
      return;
    }

    const needsLocalMedia = role !== "viewer";
    const previewReady = await ensurePreviewStream(needsLocalMedia);
    if (!previewReady) {
      return;
    }

    disconnectLiveRoom(true);
    manualDisconnectRef.current = false;
    setConnectionState("connecting");
    setError("");
    setStatus("جارٍ فتح قناة الإشارة وبناء الجلسة الحية...");
    setLiveRole(role);
    roleRef.current = role;
    activeSessionRef.current = session;

    const socket = new ReliableWebSocketClient(mediaWsUrl, {
      onStateChange: (state) => handleSocketStateChange(state),
      onOpen: () => {
        resetRemoteState();
        socket.sendJSON({
          type: "join",
          roomId,
          role,
          mode: session.mode,
          preset: session.preset,
          displayName: getLiveRoleLabel(role),
        });
      },
      onMessage: (event) => {
        void handleSocketMessage(event, role, session);
      },
      onError: () => {
        setError("تعذر فتح قناة الإشارة المباشرة مع الخادم.");
      },
    });
    wsRef.current = socket;
    const roomId = buildRoomId(session);
    roomIdRef.current = roomId;
    socket.connect();
  }

  function handleSocketStateChange(state: ReliableWebSocketState) {
    if (manualDisconnectRef.current && state === "closed") {
      manualDisconnectRef.current = false;
      return;
    }

    if (state === "connecting") {
      setConnectionState("connecting");
      setStatus("جارٍ فتح قناة الإشارة وبناء الجلسة الحية...");
      return;
    }

    if (state === "reconnecting") {
      resetRemoteState();
      setConnectionState("connecting");
      setStatus("انقطع الاتصال مؤقتاً. جارٍ إعادة الربط بالغرفة الحية...");
      setError("");
      return;
    }

    if (state === "closed" && activeSessionRef.current) {
      setConnectionState("idle");
      setStatus("");
      setError("تعذر استعادة الاتصال بغرفة البث الحي.");
    }
  }

  async function handleSocketMessage(event: MessageEvent, role: LiveRole, session: MediaSession) {
    const message = JSON.parse(event.data as string) as Record<string, unknown>;

    if (message.type === "joined") {
      const joinedPeerId = readRecordString(message, "peerId");
      peerIdRef.current = joinedPeerId;
      setConnectionState("connected");
      setHostPeerId(readRecordString(message, "hostPeerId"));
      setPeerCount(readRecordNumber(message, "peerCount", 1));
      setError("");
      setStatus(role === "host" ? "الغرفة الحية بدأت. يمكن الآن استقبال المشاركين." : "تم الالتحاق بالغرفة الحية بنجاح.");

      const peers = ((message.peers as PeerSummary[] | undefined) || []);
      for (const peer of peers) {
        upsertRemotePeer(peer);
      }

      for (const peer of peers) {
        if (shouldInitiatePeer(role, session.mode, joinedPeerId, peer)) {
          await createPeerConnection(peer, true);
        }
      }
      return;
    }

    if (message.type === "peer-joined") {
      const peer = message.peer as PeerSummary;
      if (!peer) {
        return;
      }

      upsertRemotePeer(peer);
      setPeerCount((current) => Math.max(current + 1, 2));
      setHostPeerId(readRecordString(message, "hostPeerId"));

      if (peerIdRef.current && shouldInitiatePeer(roleRef.current, session.mode, peerIdRef.current, peer)) {
        await createPeerConnection(peer, true);
      }
      return;
    }

    if (message.type === "peer-left") {
      const peerId = readRecordString(message, "peerId");
      removeRemotePeer(peerId);
      setPeerCount((current) => Math.max(current - 1, 1));
      setHostPeerId(readRecordString(message, "hostPeerId"));
      return;
    }

    if (message.type === "room-state") {
      setHostPeerId(readRecordString(message, "hostPeerId"));
      setPeerCount(readRecordNumber(message, "peerCount"));
      return;
    }

    if (message.type === "signal") {
      await handleSignalMessage(message as unknown as SignalEnvelope);
      return;
    }

    if (message.type === "error") {
      setError(readRecordString(message, "message") || "حدث خطأ في قناة البث الحي.");
      setConnectionState("idle");
    }
  }

  async function startPreview() {
    setError("");
    setStatus("جارٍ تجهيز المعاينة...");

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const media = await navigator.mediaDevices.getUserMedia({
        video: withCamera,
        audio: withMic,
      });

      streamRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
      setStatus("المعاينة جاهزة. يمكنك الآن إنشاء غرفة أو بدء بث.");
    } catch {
      setError("تعذر الوصول إلى الكاميرا أو الميكروفون. تحقق من أذونات المتصفح.");
      setStatus("");
    }
  }

  async function startScreenShare() {
    setError("");
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: withMic,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = displayStream;
      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }
      setShareScreen(true);
      setStatus("تم تشغيل مشاركة الشاشة. يمكن استخدام الجلسة للبث أو العرض المباشر.");
    } catch {
      setError("لم يتم تفعيل مشاركة الشاشة.");
    }
  }

  function stopPreview() {
    disconnectLiveRoom(true);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShareScreen(false);
    setStatus("تم إيقاف المعاينة.");
  }

  function createSession() {
    setWorkflow("host");
    const session = createSessionRecord();
    const next = [session, ...sessions.filter((item) => item.code !== session.code)].slice(0, 8);
    persistSessions(next);

    setSessionCode(session.code);
    setInviteLink(session.viewerUrl);
    setStatus(
      preset === "broadcast"
        ? "تم تجهيز قناة البث. يمكنك مشاركة الرابط أو استخدامه كنقطة انطلاق للبث الخارجي."
        : "تم تجهيز غرفة الاجتماع. الرابط والكود جاهزان للمشاركة."
    );
    setError("");
    return session;
  }

  function joinSession() {
    setWorkflow("join");
    const found = getSessionByCode(joinCode);
    if (!found) {
      setError("لم يتم العثور على جلسة بهذا الكود على هذا الجهاز. شارك الرابط أو أنشئ الجلسة أولاً.");
      return;
    }

    setInviteLink(found.viewerUrl);
    setSessionCode(found.code);
    setRoomName(found.title);
    setAudience(found.audience);
    setPreset(found.preset);
    setChannelMode(found.mode);
    setStatus(`تم فتح الجلسة ${found.title}. يمكنك استخدامها للمشاهدة أو الانضمام.`);
    setError("");
  }

  async function startLiveSession() {
    setWorkflow("host");
    const session = getActiveSession() ?? createSession();
    await connectToRoom("host", session);
  }

  async function joinLiveSession() {
    setWorkflow("join");
    const found = getSessionByCode(joinCode) ?? getActiveSession();
    if (!found) {
      setError("أنشئ الجلسة أولاً أو افتح رابط دعوة صالح قبل محاولة الانضمام المباشر.");
      return;
    }

    const joinAs: LiveRole = found.mode === "relay" ? "viewer" : "participant";
    await connectToRoom(joinAs, found);
  }

  async function shareSession() {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: roomName,
          text: `انضم إلى ${roomName} عبر موطني`,
          url: inviteLink,
        });
        setStatus("تمت مشاركة الجلسة.");
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await copyInvite();
  }

  function openRelayDetails(session: MediaSession) {
    setWorkflow("join");
    setInviteLink(session.mode === "relay" ? session.relayUrl : session.viewerUrl);
    setSessionCode(session.code);
    setJoinCode(session.code);
    setRoomName(session.title);
    setPreset(session.preset);
    setChannelMode(session.mode);
    setStatus(session.mode === "relay"
      ? `القناة غير المباشرة جاهزة. مفتاح الإدخال: ${session.ingestKey}`
      : `القناة المباشرة جاهزة للمشاركة برابط المشاهدة.`);
  }

  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setStatus("تم نسخ رابط الدعوة.");
  }

  const connectionLabel = getConnectionLabel(connectionState);
  const liveRoleLabel = getLiveRoleSummary(liveRole);
  const inviteStatus = inviteLink ? "رابط الدعوة جاهز للمشاركة" : "لم يتم إنشاء رابط دعوة بعد";
  const liveBarTitle = connectionState === "connected" ? "متصل الآن" : connectionLabel;
  const sessionOrigin = globalThis.window === undefined ? "" : globalThis.window.location.origin;
  const relayStreamPath = `${sessionOrigin}/media/relay/${sessionCode || "SESSION"}`;
  const directStreamPath = `${sessionOrigin}/live/${sessionCode || "SESSION"}`;
  const ingestKeyLabel = sessionCode ? `${roomName.trim().replace(/\s+/g, "-").toLowerCase()}_${sessionCode}` : "سيظهر بعد الإنشاء";
  const workflowLabel = workflow === "host" ? "الاستضافة" : "الانضمام";
  const workflowSummary = workflow === "host"
    ? "جهّز المعاينة وأنشئ الجلسة ثم ابدأ البث أو الاجتماع مباشرة."
    : "أدخل الكود أو اختر جلسة محفوظة للفتح أو الانضمام الحي بسرعة.";
  const workflowActionLabel = workflow === "host" ? "تجهيز الجلسة" : "فتح الجلسة بالكود";
  const deliveryPanelOpen = Boolean(inviteLink || sessionCode);
  const livePanelOpen = connectionState !== "idle" || remotePeers.length > 0;

  return (
    <div className="media-center">
      <section className="media-hero">
        <div className="media-hero__copy">
          <p className="media-eyebrow">غرف مباشرة وقنوات تشغيل مرنة</p>
          <h2>مركز الاجتماعات والبث داخل موطني</h2>
          <p>{workflowSummary}</p>
        </div>

        <div className="media-workflow-switcher" aria-label="مسار العمل الحالي">
          <button
            type="button"
            className={`media-workflow-chip ${workflow === "host" ? "is-active" : ""}`}
            onClick={() => setWorkflow("host")}
            aria-pressed={workflow === "host"}
          >
            <strong>الاستضافة</strong>
            <span>المعاينة، الإعداد، والرابط</span>
          </button>
          <button
            type="button"
            className={`media-workflow-chip ${workflow === "join" ? "is-active" : ""}`}
            onClick={() => setWorkflow("join")}
            aria-pressed={workflow === "join"}
          >
            <strong>الانضمام</strong>
            <span>الكود، الاسترجاع، والدخول الحي</span>
          </button>
        </div>

        <div className="media-hero__metrics">
          <div>
            <strong>{workflowLabel}</strong>
            <span>المسار الحالي</span>
          </div>
          <div>
            <strong>{liveBarTitle}</strong>
            <span>{liveRoleLabel}</span>
          </div>
          <div>
            <strong>{inviteLink ? "جاهز" : "بانتظار الإنشاء"}</strong>
            <span>رابط الدعوة</span>
          </div>
        </div>
        <div className="media-hero__actions">
          <button className="btn" onClick={() => setVoiceModeOpen(true)}>
            <Mic24Regular aria-hidden />
            <span>تشغيل المحادثة الصوتية</span>
          </button>
          <button className="btn btn-secondary" onClick={workflow === "host" ? createSession : joinSession}>
            {workflow === "host" ? <AddCircle24Regular aria-hidden /> : <ArrowCircleRight24Regular aria-hidden />}
            <span>{workflowActionLabel}</span>
          </button>
          <button className="btn btn-secondary" onClick={shareSession} disabled={!inviteLink}>
            <Share24Regular aria-hidden />
            <span>مشاركة رابط الجلسة</span>
          </button>
        </div>
      </section>

      {(status || error) && (
        <div className={`media-status ${error ? "is-error" : "is-ok"}`}>
          {error || status}
        </div>
      )}

      {workflow === "host" ? (
        <>
          <section className="media-presets">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`media-preset ${preset === item.id ? "is-active" : ""}`}
                style={getMediaAccentStyle(item.accent)}
                onClick={() => setPreset(item.id)}
              >
                <item.icon aria-hidden />
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </section>

          <section className="media-grid media-grid--host">
            <article className="media-card media-card--preview">
              <div className="media-card__header">
                <div>
                  <h3>المعاينة المحلية</h3>
                  <p>{activePreset.desc}</p>
                </div>
                <span className={`media-badge media-badge--${channelMode}`}>{channelMode === "direct" ? "مباشر" : "غير مباشر"}</span>
              </div>

              <div className="media-preview-frame">
                <video ref={videoRef} autoPlay muted playsInline>
                  <track kind="captions" srcLang="ar" label="Arabic captions" />
                </video>
                {!streamRef.current && (
                  <div className="media-preview-placeholder">
                    <activePreset.icon aria-hidden />
                    <span>شغّل المعاينة لالتقاط الكاميرا أو الشاشة</span>
                  </div>
                )}
              </div>

              <div className="media-preview-actions">
                <button className="btn" onClick={startPreview}>تشغيل المعاينة</button>
                <button className="btn btn-secondary" onClick={startScreenShare}>تفعيل مشاركة الشاشة</button>
                <button className="btn btn-secondary" onClick={startLiveSession}>بدء الجلسة الحية</button>
                <button className="btn btn-secondary" onClick={stopPreview}>إيقاف المعاينة</button>
              </div>
            </article>

            <article className="media-card media-card--setup">
              <div className="media-card__header">
                <div>
                  <h3>إعدادات الجلسة</h3>
                  <p>اختر بين قناة مباشرة أو قناة تمر عبر وسيط أو فريق تشغيل.</p>
                </div>
              </div>

              <div className="media-form-grid">
                <label className="media-field">
                  <span>اسم الغرفة</span>
                  <input className="input" value={roomName} onChange={(event) => setRoomName(event.target.value)} />
                </label>

                <label className="media-field">
                  <span>الجمهور أو القناة</span>
                  <input className="input" value={audience} onChange={(event) => setAudience(event.target.value)} />
                </label>

                <div className="media-field">
                  <span>نوع القناة</span>
                  <div className="media-toggle-group">
                    <button type="button" className={channelMode === "direct" ? "is-active" : ""} onClick={() => setChannelMode("direct")}>مباشرة</button>
                    <button type="button" className={channelMode === "relay" ? "is-active" : ""} onClick={() => setChannelMode("relay")}>غير مباشرة</button>
                  </div>
                </div>

                <div className="media-field">
                  <span>المكونات</span>
                  <div className="media-checks">
                    <label><input type="checkbox" checked={withCamera} onChange={() => setWithCamera((value) => !value)} /> كاميرا</label>
                    <label><input type="checkbox" checked={withMic} onChange={() => setWithMic((value) => !value)} /> ميكروفون</label>
                    <label><input type="checkbox" checked={shareScreen} onChange={() => setShareScreen((value) => !value)} /> شاشة</label>
                  </div>
                </div>
              </div>

              <div className="media-actions-stack">
                <button className="btn" onClick={createSession}>إنشاء الجلسة</button>
                <button className="btn btn-secondary" onClick={startLiveSession}>فتح الجلسة كمضيف</button>
                <button className="btn btn-secondary" onClick={copyInvite} disabled={!inviteLink}>نسخ رابط الدعوة</button>
                <button className="btn btn-secondary" onClick={shareSession} disabled={!inviteLink}>مشاركة الجلسة</button>
              </div>
            </article>
          </section>
        </>
      ) : (
        <section className="media-grid media-grid--join">
          <article className="media-card">
            <div className="media-card__header">
              <div>
                <h3>الانضمام أو الاسترجاع</h3>
                <p>استخدم الكود لاسترجاع جلسة مباشرة أو غير مباشرة محفوظة على هذا الجهاز.</p>
              </div>
            </div>

            <div className="media-form-grid">
              <label className="media-field">
                <span>كود الجلسة</span>
                <input className="input" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="مثال: AB12CD" />
              </label>
            </div>

            <div className="media-actions-stack">
              <button className="btn" onClick={joinSession}>فتح الجلسة</button>
              <button className="btn btn-secondary" onClick={joinLiveSession}>الانضمام الحي</button>
              <button className="btn btn-secondary" onClick={() => setVoiceModeOpen(true)}>محادثة صوتية</button>
            </div>
          </article>

          <article className="media-card media-card--sessions">
            <div className="media-card__header">
              <div>
                <h3>الجلسات المحفوظة</h3>
                <p>آخر القنوات التي أنشأتها لهذا الجهاز.</p>
              </div>
            </div>

            <div className="media-session-list">
              {sessions.length === 0 ? (
                <div className="media-session-empty">لا توجد جلسات بعد. أنشئ أول غرفة أو قناة.</div>
              ) : sessions.map((session) => (
                <button key={session.id} className="media-session-item" data-feature-key={session.id} onClick={() => openRelayDetails(session)}>
                  <div>
                    <strong>{session.title}</strong>
                    <span>{session.mode === "relay" ? "قناة غير مباشرة" : "جلسة مباشرة"} • {session.audience}</span>
                  </div>
                  <div className="media-session-meta">
                    <span>{session.code}</span>
                    {session.mode === "relay" ? <Megaphone24Regular aria-hidden /> : <Video24Regular aria-hidden />}
                  </div>
                </button>
              ))}
            </div>
          </article>
        </section>
      )}

      <section className="media-section-stack">
        <details className="media-details" open={deliveryPanelOpen}>
          <summary className="media-details__summary">
            <span className="media-details__summary-text">رابط الدعوة ومسار البث</span>
            <span className="media-details__meta">{inviteStatus}</span>
          </summary>

          <div className="media-details__content">
            <div className="media-invite-box">
              <span>الكود</span>
              <strong>{sessionCode || "لم يتم الإنشاء بعد"}</strong>
            </div>

            <div className="media-invite-box media-invite-box--url">
              <span>الرابط</span>
              <strong>{inviteLink || "سيظهر هنا رابط الجلسة"}</strong>
            </div>

            <div className="media-invite-box">
              <span>مسار البث</span>
              <strong>{channelMode === "relay" ? relayStreamPath : directStreamPath}</strong>
            </div>

            {channelMode === "relay" && (
              <div className="media-invite-box">
                <span>مفتاح الإدخال</span>
                <strong>{ingestKeyLabel}</strong>
              </div>
            )}

            <div className="media-actions-stack media-actions-stack--compact">
              <button className="btn btn-secondary" onClick={copyInvite} disabled={!inviteLink}>نسخ الرابط</button>
              <button className="btn btn-secondary" onClick={shareSession} disabled={!inviteLink}>مشاركة الجلسة</button>
            </div>
          </div>
        </details>

        <details className="media-details">
          <summary className="media-details__summary">
            <span className="media-details__summary-text">جاهزية التشغيل</span>
            <span className="media-details__meta">متطلبات وملاحظات</span>
          </summary>

          <div className="media-details__content">
            <ul className="media-checklist">
              <li>المحادثة الصوتية متاحة مباشرة من داخل موطني لبدء نقاش صوتي سريع قبل الجلسة أو خلالها.</li>
              <li>غرفة الفيديو المباشر تناسب الدعم الفردي أو الاجتماع السريع بين عدة أطراف.</li>
              <li>قناة Relay غير المباشرة تعرض مسار البث ومفتاح الإدخال للربط الخلفي عند الحاجة.</li>
              <li>الرابط والكود يظهران فور تجهيز الجلسة ويمكن مشاركتهما عبر واتساب أو البريد.</li>
            </ul>
          </div>
        </details>

        <details className="media-details" open={livePanelOpen}>
          <summary className="media-details__summary">
            <span className="media-details__summary-text">المشاركون والجلسة الحية</span>
            <span className="media-details__meta">{peerCount > 0 ? `${peerCount} أطراف داخل الجلسة` : connectionLabel}</span>
          </summary>

          <div className="media-details__content">
            <div className="media-live-bar">
              <strong>{liveBarTitle}</strong>
              <span>{liveRoleLabel}</span>
              <span>{peerCount > 0 ? `${peerCount} أطراف داخل الجلسة` : "لا يوجد مشاركون بعد"}</span>
              {connectionState !== "idle" && <button className="btn btn-secondary" onClick={() => disconnectLiveRoom()}>إنهاء الاتصال</button>}
            </div>

            <div className="media-live-grid">
              {remotePeers.length === 0 ? (
                <div className="media-live-empty">عند فتح الجلسة الحية أو الانضمام إليها ستظهر الفيديوهات والأطراف هنا.</div>
              ) : remotePeers.map((peer) => (
                <div key={peer.peerId} className="media-live-tile">
                  <video
                    autoPlay
                    playsInline
                    ref={(node) => {
                      if (!node) {
                        remoteVideoElementsRef.current.delete(peer.peerId);
                        return;
                      }

                      remoteVideoElementsRef.current.set(peer.peerId, node);
                      if (peer.stream) {
                        node.srcObject = peer.stream;
                      }
                    }}
                  >
                    <track kind="captions" srcLang="ar" label="Arabic captions" />
                  </video>
                  <div className="media-live-meta">
                    <strong>{peer.displayName}</strong>
                    <span>{getLiveRoleSummary(peer.role)}</span>
                    <span>{peer.peerId === hostPeerId ? "قائد الجلسة" : "طرف متصل"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>

      {voiceModeOpen && <VoiceMode onClose={() => setVoiceModeOpen(false)} />}
    </div>
  );
}

