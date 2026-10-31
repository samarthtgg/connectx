"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};
type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string | null;
  created_at: string | null;
};
type CallSession = {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: "ringing" | "accepted" | "rejected" | "ended" | "missed";
  call_type: "audio" | "video";
  offer: RTCSessionDescriptionInit;
  answer: RTCSessionDescriptionInit | null;
  created_at: string;
};
type IceCandidateRow = {
  id: string;
  call_id: string;
  sender_id: string;
  candidate: RTCIceCandidateInit;
};
type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

const displayName = (profile: Profile) =>
  profile.full_name?.trim() || profile.username || "ConnectX user";
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ChatPreview() {
  const [userId, setUserId] = useState("");
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"Messages" | "Friends" | "Settings">("Messages");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callMode, setCallMode] = useState<"audio" | "video">("audio");
  const [callStatus, setCallStatus] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef("");
  const pendingLocalCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteCandidates = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const loadBase = useCallback(async (id: string) => {
    const [profileResult, peopleResult, requestResult] = await Promise.all([
      supabase.from("profiles").select("id,username,full_name,avatar_url").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("id,username,full_name,avatar_url").neq("id", id).order("full_name"),
      supabase.from("friend_requests").select("id,sender_id,receiver_id,status,created_at")
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`).order("created_at", { ascending: false }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (peopleResult.error) throw peopleResult.error;
    if (requestResult.error) throw requestResult.error;
    setMyProfile(profileResult.data);
    setProfiles((peopleResult.data ?? []) as Profile[]);
    setRequests((requestResult.data ?? []) as FriendRequest[]);
  }, []);

  const refreshRequests = useCallback(async () => {
    if (!userId) return;
    const { data, error: requestError } = await supabase.from("friend_requests")
      .select("id,sender_id,receiver_id,status,created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (requestError) throw requestError;
    setRequests((data ?? []) as FriendRequest[]);
  }, [userId]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (!active) return;
      if (authError) throw authError;
      if (!data.user) {
        setError("Please sign in to use ConnectX messaging.");
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      await loadBase(data.user.id);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load your ConnectX account.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadBase]);

  const acceptedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const request of requests) {
      if (request.status === "accepted") {
        ids.add(request.sender_id === userId ? request.receiver_id : request.sender_id);
      }
    }
    return ids;
  }, [requests, userId]);

  const incoming = useMemo(
    () => requests.filter((r) => r.receiver_id === userId && r.status === "pending"),
    [requests, userId],
  );
  const friends = useMemo(
    () => profiles.filter((profile) => acceptedIds.has(profile.id)),
    [profiles, acceptedIds],
  );
  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const name = displayName(p).toLowerCase();
      const username = (p.username ?? "").toLowerCase();
      return !q || name.includes(q) || username.includes(q);
    });
  }, [profiles, search]);

  const loadMessages = useCallback(async (friendId: string) => {
    if (!userId) return;
    const { data, error: messageError } = await supabase.from("messages")
      .select("id,sender_id,receiver_id,content,created_at")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    if (messageError) throw messageError;
    setMessages((data ?? []) as DirectMessage[]);
  }, [userId]);

  useEffect(() => {
    if (!userId || !selectedFriend) {
      setMessages([]);
      return;
    }
    let active = true;
    loadMessages(selectedFriend.id).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load messages.");
    });
    const channel = supabase.channel(`direct-messages-${userId}-${selectedFriend.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as DirectMessage;
        const belongsToChat =
          (row.sender_id === userId && row.receiver_id === selectedFriend.id) ||
          (row.sender_id === selectedFriend.id && row.receiver_id === userId);
        if (belongsToChat) {
          setMessages((old) => old.some((item) => item.id === row.id) ? old : [...old, row]);
        }
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, selectedFriend, loadMessages]);

  async function chooseFriend(friend: Profile) {
    setSelectedFriend(friend);
    setShowMobileChat(true);
    setTab("Messages");
    setError("");
  }

  async function sendRequest(profile: Profile) {
    if (!userId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const existing = requests.find((r) =>
        (r.sender_id === userId && r.receiver_id === profile.id) ||
        (r.sender_id === profile.id && r.receiver_id === userId)
      );
      if (existing) {
        setNotice(existing.status === "accepted" ? "You are already friends." :
          existing.status === "pending" ? (existing.sender_id === userId ? "Friend request already sent." : "Accept the incoming request below.") :
          "A previous request exists. Ask the other person to send you a request.");
        return;
      }
      const { error: insertError } = await supabase.from("friend_requests").insert({
        sender_id: userId, receiver_id: profile.id, status: "pending",
      });
      if (insertError) throw insertError;
      await refreshRequests();
      setNotice(`Friend request sent to ${displayName(profile)}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send friend request.");
    } finally {
      setBusy(false);
    }
  }

  async function respondToRequest(request: FriendRequest, status: "accepted" | "declined") {
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("friend_requests")
        .update({ status }).eq("id", request.id).eq("receiver_id", userId).eq("status", "pending");
      if (updateError) throw updateError;
      await refreshRequests();
      setNotice(status === "accepted" ? "Friend request accepted." : "Friend request declined.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update friend request.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedFriend || !userId || busy) return;
    setBusy(true); setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user || authData.user.id !== userId) {
        throw new Error("Your active sign-in session does not match the account loaded by ConnectX. Sign out and sign in again.");
      }
      const { data, error: insertError } = await supabase.from("messages")
        .insert({ sender_id: authData.user.id, receiver_id: selectedFriend.id, content })
        .select("id,sender_id,receiver_id,content,created_at")
        .single();
      if (insertError) {
        console.error("ConnectX message insert failed", {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          sender_id: authData.user.id,
          receiver_id: selectedFriend.id,
        });
        setError([
          insertError.message,
          insertError.details,
          insertError.hint,
          insertError.code ? `Code: ${insertError.code}` : "",
        ].filter(Boolean).join(" — "));
      } else if (data) {
        setMessages((old) => old.some((item) => item.id === data.id) ? old : [...old, data as DirectMessage]);
        setDraft("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else window.location.href = "/";
    setBusy(false);
  }

  const activeName = selectedFriend ? displayName(selectedFriend) : "";

  const resetCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    callIdRef.current = "";
    pendingLocalCandidates.current = [];
    pendingRemoteCandidates.current = [];
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus("");
    setMuted(false);
    setCameraOff(false);
  }, [localStream]);

  const flushRemoteCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const queued = pendingRemoteCandidates.current.splice(0);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (reason) { console.warn("ConnectX ICE candidate could not be added", reason); }
    }
  }, []);

  const createCallPeer = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      const incoming = event.streams[0];
      if (incoming) setRemoteStream(incoming);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setCallStatus("Connected");
      if (pc.connectionState === "failed") setCallStatus("Connection failed. Try another network.");
      if (pc.connectionState === "disconnected") setCallStatus("Connection interrupted…");
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      const callId = callIdRef.current;
      if (!callId) {
        pendingLocalCandidates.current.push(candidate);
        return;
      }
      void supabase.from("call_ice_candidates").insert({
        call_id: callId, sender_id: userId, candidate,
      }).then(({ error: candidateError }) => {
        if (candidateError) console.error("ConnectX ICE signaling error", candidateError);
      });
    };
    pcRef.current = pc;
    return pc;
  }, [userId]);

  const flushLocalCandidates = useCallback(async (callId: string) => {
    const queued = pendingLocalCandidates.current.splice(0);
    if (!queued.length) return;
    const { error: candidateError } = await supabase.from("call_ice_candidates").insert(
      queued.map((candidate) => ({ call_id: callId, sender_id: userId, candidate })),
    );
    if (candidateError) throw candidateError;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`incoming-calls-${userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "call_sessions",
        filter: `receiver_id=eq.${userId}`,
      }, (payload) => {
        const call = payload.new as CallSession;
        if (call.status === "ringing" && !activeCall && !incomingCall) {
          setIncomingCall(call);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !activeCall && !incomingCall) {
          const { data } = await supabase.from("call_sessions")
            .select("id,caller_id,receiver_id,status,call_type,offer,answer,created_at")
            .eq("receiver_id", userId).eq("status", "ringing")
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (data) setIncomingCall(data as CallSession);
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [userId, activeCall, incomingCall]);

  useEffect(() => {
    if (!activeCall || !userId) return;
    const channel = supabase.channel(`active-call-${activeCall.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "call_sessions",
        filter: `id=eq.${activeCall.id}`,
      }, (payload) => {
        const updated = payload.new as CallSession;
        if (updated.status === "rejected" || updated.status === "ended" || updated.status === "missed") {
          resetCall();
          return;
        }
        if (updated.answer && updated.caller_id === userId && pcRef.current && !pcRef.current.remoteDescription) {
          void pcRef.current.setRemoteDescription(new RTCSessionDescription(updated.answer))
            .then(flushRemoteCandidates)
            .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not connect the call."));
          setCallStatus("Connecting…");
        }
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "call_ice_candidates",
        filter: `call_id=eq.${activeCall.id}`,
      }, (payload) => {
        const row = payload.new as IceCandidateRow;
        if (row.sender_id === userId || !pcRef.current) return;
        if (pcRef.current.remoteDescription) {
          void pcRef.current.addIceCandidate(new RTCIceCandidate(row.candidate))
            .catch((reason) => console.warn("ConnectX ICE candidate error", reason));
        } else {
          pendingRemoteCandidates.current.push(row.candidate);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const [{ data: session }, { data: candidates }] = await Promise.all([
            supabase.from("call_sessions").select("id,caller_id,receiver_id,status,call_type,offer,answer,created_at")
              .eq("id", activeCall.id).maybeSingle(),
            supabase.from("call_ice_candidates").select("id,call_id,sender_id,candidate")
              .eq("call_id", activeCall.id).order("created_at"),
          ]);
          if (session?.status === "rejected" || session?.status === "ended" || session?.status === "missed") {
            resetCall();
            return;
          }
          if (session?.answer && session.caller_id === userId && pcRef.current && !pcRef.current.remoteDescription) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(session.answer));
            await flushRemoteCandidates();
          }
          for (const row of (candidates ?? []) as IceCandidateRow[]) {
            if (row.sender_id === userId) continue;
            if (pcRef.current?.remoteDescription) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(row.candidate)); }
              catch (reason) { console.warn("ConnectX existing ICE candidate error", reason); }
            } else pendingRemoteCandidates.current.push(row.candidate);
          }
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [activeCall?.id, userId, resetCall, flushRemoteCandidates]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current && remoteStream) remoteAudioRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream, callMode]);

  async function startCall(mode: "audio" | "video") {
    if (!selectedFriend || !userId || activeCall || incomingCall) return;
    setError(""); setNotice(""); setCallStatus("Preparing call…");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
      const pc = createCallPeer(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const { data, error: insertError } = await supabase.from("call_sessions")
        .insert({
          caller_id: userId, receiver_id: selectedFriend.id, call_type: mode,
          status: "ringing", offer: pc.localDescription?.toJSON() ?? offer,
        })
        .select("id,caller_id,receiver_id,status,call_type,offer,answer,created_at").single();
      if (insertError) throw insertError;
      callIdRef.current = data.id;
      await flushLocalCandidates(data.id);
      setLocalStream(stream);
      setCallMode(mode);
      setActiveCall(data as CallSession);
      setCallStatus(`Calling ${displayName(selectedFriend)}…`);
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close(); pcRef.current = null; callIdRef.current = "";
      setCallStatus("");
      setError(reason instanceof Error ? reason.message : "Could not start the call. Check camera and microphone permissions.");
    }
  }

  async function acceptCall(call: CallSession) {
    let stream: MediaStream | null = null;
    setError(""); setCallStatus("Joining call…");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: call.call_type === "video",
      });
      callIdRef.current = call.id;
      const pc = createCallPeer(stream);
      await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
      await flushRemoteCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const { error: updateError } = await supabase.from("call_sessions")
        .update({ answer: pc.localDescription?.toJSON() ?? answer, status: "accepted" })
        .eq("id", call.id).eq("receiver_id", userId);
      if (updateError) throw updateError;
      setLocalStream(stream);
      setCallMode(call.call_type);
      setActiveCall(call);
      setIncomingCall(null);
      setCallStatus("Connecting…");
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close(); pcRef.current = null; callIdRef.current = "";
      setCallStatus("");
      setError(reason instanceof Error ? reason.message : "Could not accept the call. Check camera and microphone permissions.");
    }
  }

  async function rejectCall(call: CallSession) {
    const { error: updateError } = await supabase.from("call_sessions")
      .update({ status: "rejected", ended_at: new Date().toISOString() })
      .eq("id", call.id).eq("receiver_id", userId);
    if (updateError) setError(updateError.message);
    setIncomingCall(null);
  }

  async function endCall() {
    const callId = activeCall?.id;
    if (callId) {
      const { error: updateError } = await supabase.from("call_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
      if (updateError) setError(updateError.message);
    }
    resetCall();
  }

  function toggleMute() {
    const next = !muted;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStream?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setCameraOff(next);
  }

  return (
    <main className="cx-shell">
      <aside className="cx-rail">
        <div className="cx-mark">✦</div>
        {(["Messages", "Friends", "Settings"] as const).map((item, index) => (
          <button key={item} className={tab === item ? "rail-btn selected" : "rail-btn"}
            onClick={() => { setTab(item); setShowMobileChat(false); }} aria-label={item}>
            {["▤", "♙", "⚙"][index]}
          </button>
        ))}
        <div className="rail-spacer" /><div className="cx-user">{initials(myProfile?.full_name || myProfile?.username || "U")}</div>
      </aside>

      <section className={`cx-list ${showMobileChat ? "hide-mobile" : ""}`}>
        <header className="list-head">
          <div><div className="cx-brand"><span>✦</span> ConnectX</div><p>Your space to connect</p></div>
          <button className="icon-btn" aria-label="Refresh" onClick={() => loadBase(userId).catch((e) => setError(e.message))}>↻</button>
        </header>

        {tab !== "Settings" && <div className="search-box"><span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "Friends" ? "Find people by name or username" : "Search friends"} /></div>}

        <div className="list-label">{tab.toUpperCase()} <span>{tab === "Friends" ? filteredProfiles.length : tab === "Messages" ? friends.length : ""}</span></div>

        {loading ? <p className="empty">Loading your account…</p> : tab === "Settings" ? (
          <div className="settings-panel">
            <div className="large-avatar">{initials(myProfile?.full_name || myProfile?.username || "U")}</div>
            <h3>{myProfile ? displayName(myProfile) : "Your profile"}</h3>
            <p>{myProfile?.username ? `@${myProfile.username}` : "Choose a username later"}</p>
            <button className="action-btn secondary" onClick={signOut} disabled={busy}>Sign out</button>
          </div>
        ) : tab === "Friends" ? (
          <div className="cx-chats">
            <div className="section-caption">PEOPLE</div>
            {filteredProfiles.map((profile) => {
              const relation = requests.find((r) =>
                (r.sender_id === userId && r.receiver_id === profile.id) ||
                (r.sender_id === profile.id && r.receiver_id === userId)
              );
              const label = relation?.status === "accepted" ? "Friends" :
                relation?.status === "pending" ? (relation.sender_id === userId ? "Requested" : "Respond below") : "Add friend";
              return <div className="person-row" key={profile.id}>
                <span className="avatar">{initials(displayName(profile))}</span>
                <span className="chat-info"><strong>{displayName(profile)}</strong><small>{profile.username ? `@${profile.username}` : "ConnectX member"}</small></span>
                <button className="mini-btn" disabled={busy || !!relation} onClick={() => sendRequest(profile)}>{label}</button>
              </div>;
            })}
            {filteredProfiles.length === 0 && <p className="empty">No users found.</p>}
            <div className="section-caption request-caption">INCOMING REQUESTS · {incoming.length}</div>
            {incoming.map((request) => {
              const sender = profiles.find((p) => p.id === request.sender_id);
              return <div className="request-row" key={request.id}>
                <span>{sender ? displayName(sender) : "ConnectX user"}</span>
                <button className="mini-btn" disabled={busy} onClick={() => respondToRequest(request, "accepted")}>Accept</button>
                <button className="mini-btn muted-btn" disabled={busy} onClick={() => respondToRequest(request, "declined")}>Decline</button>
              </div>;
            })}
          </div>
        ) : (
          <div className="cx-chats">
            {friends.map((friend) => {
              return <button key={friend.id} className={`chat-row ${selectedFriend?.id === friend.id ? "active" : ""}`}
                onClick={() => chooseFriend(friend)}>
                <span className="avatar">{initials(displayName(friend))}</span>
                <span className="chat-info"><strong>{displayName(friend)}</strong><small>{friend.username ? `@${friend.username}` : "Tap to open chat"}</small></span>
              </button>;
            })}
            {friends.length === 0 && <p className="empty">No friends yet. Open Friends to find people and send a request.</p>}
          </div>
        )}
        <div className="profile-row"><span className="profile-avatar">{initials(myProfile?.full_name || myProfile?.username || "U")}</span>
          <span><strong>{myProfile ? displayName(myProfile) : "Your account"}</strong><small>Connected account</small></span><span className="online-dot">●</span></div>
      </section>

      <section className={`cx-conversation ${showMobileChat ? "show-mobile" : ""}`}>
        {selectedFriend && tab === "Messages" ? <>
          <header className="conversation-head">
            <button className="back-btn" onClick={() => setShowMobileChat(false)}>‹</button>
            <span className="avatar">{initials(activeName)}</span>
            <div className="person"><strong>{activeName}</strong><small>ConnectX friend</small></div>
            <div className="call-actions">
              <button className="call-icon" title="Audio call" aria-label="Start audio call"
                disabled={!!activeCall || !!incomingCall} onClick={() => startCall("audio")}>☎</button>
              <button className="call-icon" title="Video call" aria-label="Start video call"
                disabled={!!activeCall || !!incomingCall} onClick={() => startCall("video")}>▣</button>
            </div>
          </header>
          <div className="messages-area">
            <div className="today">DIRECT MESSAGES</div>
            {messages.map((message) => {
              const mine = message.sender_id === userId;
              return <div key={message.id} className={mine ? "message-line mine" : "message-line"}>
                <div className={mine ? "bubble mine-bubble" : "bubble"}><p>{message.content}</p>
                  <small>{timeLabel(message.created_at)} {mine ? "✓" : ""}</small></div>
              </div>;
            })}
            {messages.length === 0 && <p className="empty">No messages yet. Say hello!</p>}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" maxLength={5000} />
            <button className="send" disabled={!draft.trim() || busy} aria-label="Send message">{busy ? "…" : "➤"}</button>
          </form>
        </> : <div className="empty-state">{tab === "Friends" ? "Find people and build your friends list." : "Choose a friend to start messaging."}</div>}
      </section>

      {incomingCall && <div className="call-overlay">
        <div className="incoming-card">
          <div className="call-avatar">✦</div>
          <h2>{incomingCall.call_type === "video" ? "Incoming video call" : "Incoming audio call"}</h2>
          <p>{profiles.find((profile) => profile.id === incomingCall.caller_id)
            ? displayName(profiles.find((profile) => profile.id === incomingCall.caller_id)!)
            : "ConnectX friend"} is calling you</p>
          <div className="incoming-actions">
            <button className="decline-call" onClick={() => rejectCall(incomingCall)}>Decline</button>
            <button className="accept-call" onClick={() => acceptCall(incomingCall)}>Accept</button>
          </div>
        </div>
      </div>}

      {activeCall && <div className="call-overlay">
        <div className="active-call-card">
          <div className="call-topline">
            <strong>{activeCall.caller_id === userId
              ? displayName(selectedFriend ?? { id: "", username: null, full_name: "ConnectX friend", avatar_url: null })
              : (profiles.find((profile) => profile.id === activeCall.caller_id)
                ? displayName(profiles.find((profile) => profile.id === activeCall.caller_id)!)
                : "ConnectX friend")}</strong>
            <span>{callStatus || "Connecting…"}</span>
          </div>
          {callMode === "video" ? <div className="video-stage">
            <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
            {!remoteStream && <div className="video-placeholder">Waiting for the other person…</div>}
          </div> : <div className="audio-stage">
            <div className="call-avatar">✦</div><p>{callStatus || "Connecting audio…"}</p>
            <audio ref={remoteAudioRef} autoPlay />
          </div>}
          <div className="call-controls">
            <button className={muted ? "control-on" : ""} onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
            {callMode === "video" && <button className={cameraOff ? "control-on" : ""} onClick={toggleCamera}>{cameraOff ? "Camera on" : "Camera off"}</button>}
            <button className="hangup" onClick={endCall}>End call</button>
          </div>
        </div>
      </div>}

      {(error || notice) && <div className={error ? "toast error-toast" : "toast"} role="status">
        <span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}>×</button>
      </div>}

      <style jsx>{`
        * { box-sizing:border-box; }
        .cx-shell { height:100dvh; min-height:540px; display:flex; overflow:hidden; background:#0b1020; color:#f5f6fc; font-family:Inter,system-ui,Arial,sans-serif; }
        .cx-rail { width:68px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:16px; padding:20px 0; background:#101727; border-right:1px solid #232d42; }
        .cx-mark { width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:#7868eb;font-size:23px;margin-bottom:16px; }
        .rail-btn { width:40px;height:40px;border:0;border-radius:12px;background:transparent;color:#8994ad;font-size:20px;cursor:pointer; }
        .rail-btn.selected { background:#29264a;color:#c8beff; }
        .rail-spacer { flex:1; }.cx-user,.profile-avatar,.large-avatar { display:grid;place-items:center;border-radius:50%;background:#554b9b;font-weight:800; }
        .cx-user { width:36px;height:36px;font-size:11px; }
        .cx-list { width:360px;min-width:300px;display:flex;flex-direction:column;background:#121a2b;border-right:1px solid #232d42; }
        .list-head { padding:24px 20px 18px;display:flex;align-items:center;justify-content:space-between; }
        .cx-brand { font-size:22px;font-weight:850;letter-spacing:-.8px; }.cx-brand span { color:#a99aff; }
        .list-head p { margin:5px 0 0;color:#8490a9;font-size:12px; }
        .icon-btn { width:36px;height:36px;border:1px solid #39445d;border-radius:11px;background:#1b2540;color:#c9bfff;font-size:22px;cursor:pointer; }
        .search-box { margin:0 17px 20px;padding:11px 12px;display:flex;gap:9px;border-radius:10px;background:#0c1424;color:#8b96ad; }
        .search-box input,.composer input { width:100%;min-width:0;border:0;outline:0;background:transparent;color:#fff;font-size:12px; }
        .list-label { display:flex;justify-content:space-between;padding:0 21px 10px;color:#7e89a2;font-size:10px;font-weight:800;letter-spacing:1.5px; }
        .cx-chats { flex:1;overflow:auto;padding:0 9px 16px; }
        .chat-row,.person-row { width:100%;display:flex;align-items:center;gap:11px;padding:12px;border:0;border-radius:13px;background:transparent;color:inherit;text-align:left;margin-bottom:4px; }
        .chat-row { cursor:pointer; }.chat-row.active { background:#202a40; }
        .avatar { width:43px;height:43px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:#6257a8;font-size:12px;font-weight:800;color:white; }
        .chat-info { flex:1;min-width:0;display:flex;flex-direction:column;gap:5px; }.chat-info strong,.person strong { font-size:13px; }.chat-info small { color:#8b96ad;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .empty { color:#8994ad;text-align:center;font-size:12px;padding:20px;line-height:1.5; }
        .profile-row { display:flex;align-items:center;gap:10px;padding:16px;border-top:1px solid #263149; }.profile-avatar { width:35px;height:35px;font-size:11px; }.profile-row strong,.profile-row small { display:block;font-size:11px; }.profile-row small { color:#8290a9;margin-top:4px; }.online-dot { margin-left:auto;color:#55c69a;font-size:11px; }
        .cx-conversation { flex:1;min-width:0;display:flex;flex-direction:column;background:#0d1423; }.conversation-head { height:78px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 24px;border-bottom:1px solid #232d42;background:#121a2b; }
        .person { flex:1; }.person small { display:block;color:#58c69c;font-size:10px;margin-top:5px; }.messages-area { flex:1;overflow:auto;padding:25px clamp(16px,5vw,70px);display:flex;flex-direction:column;gap:14px; }
        .today { align-self:center;padding:6px 12px;border-radius:20px;background:#182237;color:#8994ad;font-size:9px;letter-spacing:1px;margin-bottom:12px; }
        .message-line { display:flex;width:100%;justify-content:flex-start; }.message-line.mine { justify-content:flex-end; }.bubble { max-width:min(75%,440px);padding:11px 14px 8px;border-radius:16px 16px 16px 5px;background:#202b40; }.mine-bubble { background:#6858d8;border-radius:16px 16px 5px 16px; }.bubble p { margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere; }.bubble small { display:block;text-align:right;color:#d2ccef;font-size:9px;margin-top:5px; }
        .composer { display:flex;align-items:center;gap:10px;padding:15px 20px;border-top:1px solid #232d42;background:#121a2b; }.composer input { padding:14px;border:1px solid #37425c;border-radius:12px;background:#0c1424;font-size:13px; }.send,.mini-btn,.action-btn { border:0;border-radius:10px;background:#7868eb;color:white;font-weight:700;cursor:pointer; }.send { width:42px;height:42px;flex-shrink:0;font-size:17px; }.send:disabled,.mini-btn:disabled { opacity:.4;cursor:not-allowed; }
        .call-actions { display:flex;gap:8px;margin-left:auto; }.call-icon { width:36px;height:36px;border:1px solid #3b4560;border-radius:11px;background:#202a40;color:#d9d2ff;font-size:17px;cursor:pointer; }.call-icon:disabled { opacity:.4;cursor:not-allowed; }
        .call-overlay { position:fixed;z-index:20;inset:0;display:grid;place-items:center;padding:18px;background:#050914dd;backdrop-filter:blur(8px); }.incoming-card,.active-call-card { width:min(100%,520px);border:1px solid #3a4562;border-radius:22px;background:#151f33;color:#f5f6fc;box-shadow:0 24px 80px #0009;overflow:hidden; }.incoming-card { padding:34px 24px;text-align:center; }.call-avatar { width:82px;height:82px;margin:10px auto 20px;display:grid;place-items:center;border-radius:50%;background:#6257b5;color:white;font-size:36px; }.incoming-card h2 { margin:0;font-size:20px; }.incoming-card p { color:#9ca8c0;font-size:13px; }.incoming-actions,.call-controls { display:flex;justify-content:center;gap:12px;margin-top:26px; }.incoming-actions button,.call-controls button { padding:12px 18px;border:0;border-radius:12px;background:#303b53;color:#fff;font-weight:700; }.accept-call { background:#23875e!important; }.decline-call,.hangup { background:#b83c55!important; }.active-call-card { padding:18px; }.call-topline { display:flex;justify-content:space-between;gap:12px;align-items:center;padding:4px 4px 14px;font-size:13px; }.call-topline span { color:#9da9c0;font-size:11px; }.video-stage { position:relative;height:min(58vh,420px);min-height:230px;border-radius:15px;overflow:hidden;background:#070b14; }.remote-video { width:100%;height:100%;object-fit:cover; }.local-video { position:absolute;right:12px;bottom:12px;width:26%;max-height:35%;aspect-ratio:3/4;object-fit:cover;border:2px solid #fff;border-radius:12px;background:#202a40; }.video-placeholder { position:absolute;inset:0;display:grid;place-items:center;color:#aab5ca;font-size:12px;pointer-events:none; }.audio-stage { min-height:260px;display:grid;align-content:center;text-align:center;color:#aab5ca; }.audio-stage .call-avatar { margin-bottom:4px; }.audio-stage p { font-size:12px; }.call-controls { margin:18px 0 4px;flex-wrap:wrap; }.call-controls .control-on { background:#6557c7; }
        .back-btn { display:none;border:0;background:transparent;color:#c9bfff;font-size:28px; }.empty-state { margin:auto;color:#8490a9;text-align:center;padding:20px; }
        .section-caption { padding:14px 12px 7px;color:#77839c;font-size:9px;font-weight:800;letter-spacing:1.4px; }.request-caption { border-top:1px solid #263149;margin-top:12px; }
        .mini-btn { padding:8px 10px;font-size:10px;white-space:nowrap; }.muted-btn,.action-btn.secondary { background:#303b53;color:#d1d8e8; }
        .request-row { display:flex;align-items:center;gap:7px;padding:10px 12px;color:#dce2f2;font-size:11px; }.request-row span { flex:1; }.settings-panel { padding:24px;text-align:center; }.large-avatar { width:64px;height:64px;margin:8px auto 14px;font-size:20px; }.settings-panel h3 { margin:0;font-size:16px; }.settings-panel p { color:#8b96ad;font-size:12px; }.action-btn { padding:12px 18px;margin-top:12px; }.toast { position:fixed;z-index:5;bottom:22px;left:50%;transform:translateX(-50%);max-width:min(92vw,560px);display:flex;gap:14px;align-items:center;padding:12px 15px;border:1px solid #3b4a65;border-radius:12px;background:#1b2940;color:#dce6ff;font-size:12px;box-shadow:0 10px 40px #0008; }.toast button { border:0;background:transparent;color:white;font-size:18px; }.error-toast { border-color:#8a4250;background:#3a202c;color:#ffd2d9; }
        @media(max-width:700px) { .cx-rail { width:54px; }.cx-list { width:calc(100% - 54px);min-width:0; }.cx-conversation { display:none; }.cx-conversation.show-mobile { display:flex;position:absolute;inset:0 0 0 54px;z-index:2; }.cx-list.hide-mobile { display:none; }.back-btn { display:block; }.conversation-head { padding:0 12px;gap:9px; }.composer { padding:12px; }.messages-area { padding:20px 14px; } }
      `}</style>
    </main>
  );
}
