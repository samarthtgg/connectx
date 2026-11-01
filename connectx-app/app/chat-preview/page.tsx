"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  is_private?: boolean;
  show_last_seen?: boolean;
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
  read_at?: string | null;
  message_type?: "text" | "voice";
};
type StatusUpdate = { id:string; user_id:string; caption:string|null; media_url:string|null; media_type:"text"|"image"|"video"; created_at:string; expires_at:string; };
type MessageReaction = { id: string; message_id: string; user_id: string; emoji: string };
type ChatPreference = { friend_id: string; cleared_at: string | null; hidden_at: string | null };

const displayName = (profile: Profile) =>
  profile.full_name?.trim() || profile.username || "ConnectX user";
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ChatPreview() {
  const [userId, setUserId] = useState("");
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profilePrivate, setProfilePrivate] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [typing, setTyping] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [chatPreferences, setChatPreferences] = useState<ChatPreference[]>([]);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"Messages" | "Friends" | "Settings" | "Status">("Messages");
  const [statuses,setStatuses]=useState<StatusUpdate[]>([]);
  const [statusCaption,setStatusCaption]=useState("");
  const [statusFile,setStatusFile]=useState<File|null>(null);
  const [showStatusComposer,setShowStatusComposer]=useState(false);
  const [viewingStatusUser,setViewingStatusUser]=useState<string|null>(null);
  const [viewingStatusIndex,setViewingStatusIndex]=useState(0);
  const [recording,setRecording]=useState(false);
  const [voiceBlob,setVoiceBlob]=useState<Blob|null>(null);
  const [voicePreview,setVoicePreview]=useState("");
  const recorderRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const statusInputRef=useRef<HTMLInputElement|null>(null);
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
      supabase.from("profiles") .select("id,username,full_name,avatar_url,bio,is_private,show_last_seen").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("id,username,full_name,avatar_url").neq("id", id).order("full_name"),
      supabase.from("friend_requests").select("id,sender_id,receiver_id,status,created_at")
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`).order("created_at", { ascending: false }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (peopleResult.error) throw peopleResult.error;
    if (requestResult.error) throw requestResult.error;
    setMyProfile(profileResult.data);
    if (profileResult.data) {
      setProfileName(profileResult.data.full_name ?? "");
      setProfileUsername(profileResult.data.username ?? "");
      setProfileBio(profileResult.data.bio ?? "");
      setProfilePrivate(!!profileResult.data.is_private);
      setShowLastSeen(profileResult.data.show_last_seen !== false);
    }
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
    () => profiles.filter((profile) => acceptedIds.has(profile.id) && !chatPreferences.find((pref) => pref.friend_id === profile.id)?.hidden_at),
    [profiles, acceptedIds, chatPreferences],
  );
  const statusGroups = useMemo(() => {
    const grouped = new Map<string, StatusUpdate[]>();
    statuses.filter((status) => status.user_id !== userId).forEach((status) => {
      const current = grouped.get(status.user_id) ?? [];
      current.push(status);
      grouped.set(status.user_id, current);
    });
    return Array.from(grouped.entries()).map(([profileId, items]) => ({ profileId, latest: items[0], count: items.length }))
      .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [statuses, userId]);
  const myStatuses = useMemo(() => statuses.filter((status) => status.user_id === userId), [statuses, userId]);
  const viewingStatuses = useMemo(() => statuses.filter((status) => status.user_id === viewingStatusUser).sort((a,b) => new Date(a.created_at).getTime()-new Date(b.created_at).getTime()), [statuses, viewingStatusUser]);
  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const name = displayName(p).toLowerCase();
      const username = (p.username ?? "").toLowerCase();
      return !q || name.includes(q) || username.includes(q);
    });
  }, [profiles, search]);

  const loadChatPreferences = useCallback(async () => {
    if (!userId) return;
    const { data, error: prefError } = await supabase.from("chat_preferences")
      .select("friend_id,cleared_at,hidden_at").eq("user_id", userId);
    if (prefError) throw prefError;
    setChatPreferences((data ?? []) as ChatPreference[]);
  }, [userId]);

  useEffect(() => { if (userId) void loadChatPreferences().catch((e) => setError(e.message)); }, [userId, loadChatPreferences]);

  const loadMessages = useCallback(async (friendId: string) => {
    if (!userId) return;
    const { data, error: messageError } = await supabase.from("messages")
      .select("id,sender_id,receiver_id,content,created_at,read_at,message_type")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    if (messageError) throw messageError;
    const pref = chatPreferences.find((item) => item.friend_id === friendId);
    const visible = (data ?? []).filter((item) => !pref?.cleared_at || new Date(item.created_at) > new Date(pref.cleared_at));
    setMessages(visible as DirectMessage[]);
    const ids = visible.map((item) => item.id);
    if (ids.length) {
      const { data: reactionRows, error: reactionError } = await supabase.from("message_reactions")
        .select("id,message_id,user_id,emoji").in("message_id", ids);
      if (reactionError) throw reactionError;
      setReactions((reactionRows ?? []) as MessageReaction[]);
    } else setReactions([]);
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("sender_id", friendId).eq("receiver_id", userId).is("read_at", null);
  }, [userId, chatPreferences]);

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
    if (selectionMode) {
      setSelectedChats((old) => old.includes(friend.id) ? old.filter((id) => id !== friend.id) : [...old, friend.id]);
      return;
    }
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

  async function saveChatPreference(friendId: string, patch: { cleared_at?: string | null; hidden_at?: string | null }) {
    const { error: prefError } = await supabase.from("chat_preferences").upsert({
      user_id: userId, friend_id: friendId, ...patch, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,friend_id" });
    if (prefError) throw prefError;
    await loadChatPreferences();
  }

  async function clearSelectedChats(hide = false) {
    if (!selectedChats.length) return;
    try {
      const stamp = new Date().toISOString();
      for (const friendId of selectedChats) {
        await saveChatPreference(friendId, hide ? { hidden_at: stamp } : { cleared_at: stamp });
      }
      if (selectedFriend && selectedChats.includes(selectedFriend.id)) {
        if (hide) { setSelectedFriend(null); setShowMobileChat(false); }
        else { setMessages([]); setReactions([]); }
      }
      setSelectedChats([]); setSelectionMode(false);
      setNotice(hide ? "Selected chats hidden from your view." : "Selected chats cleared from your view.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update selected chats."); }
  }

  function beginLongPress(friendId: string) {
    longPressTriggered.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setSelectionMode(true);
      setSelectedChats((old) => old.includes(friendId) ? old : [...old, friendId]);
    }, 550);
  }
  function endLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = reactions.find((item) => item.message_id === messageId && item.user_id === userId);
    try {
      if (existing?.emoji === emoji) {
        const { error: deleteError } = await supabase.from("message_reactions").delete().eq("id", existing.id);
        if (deleteError) throw deleteError;
      } else if (existing) {
        const { error: deleteError } = await supabase.from("message_reactions").delete().eq("id", existing.id);
        if (deleteError) throw deleteError;
        const { data, error: insertError } = await supabase.from("message_reactions")
          .insert({ message_id: messageId, user_id: userId, emoji }).select("id,message_id,user_id,emoji").single();
        if (insertError) throw insertError;
        setReactions((old) => [...old.filter((item) => item.id !== existing.id), data as MessageReaction]);
      } else {
        const { data, error: insertError } = await supabase.from("message_reactions")
          .insert({ message_id: messageId, user_id: userId, emoji }).select("id,message_id,user_id,emoji").single();
        if (insertError) throw insertError;
        setReactions((old) => [...old, data as MessageReaction]);
      }
      if (existing?.emoji === emoji) setReactions((old) => old.filter((item) => item.id !== existing.id));
      setReactionMessage(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save reaction."); }
  }

  const loadStatuses=useCallback(async()=>{
    if(!userId)return;
    const {data,error}=await supabase.from("status_updates").select("id,user_id,caption,media_url,media_type,created_at,expires_at").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false});
    if(error)throw error; setStatuses((data??[]) as StatusUpdate[]);
  },[userId]);
  useEffect(()=>{if(userId)void loadStatuses().catch(e=>setError(e.message));},[userId,loadStatuses]);

  async function publishStatus(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(!userId||(!statusCaption.trim()&&!statusFile))return;
    setBusy(true);setError("");
    try{
      let mediaUrl:string|null=null; let mediaType:"text"|"image"|"video"="text";
      if(statusFile){
        if(statusFile.size>5*1024*1024)throw new Error("Status media must be 5 MB or smaller.");
        if(statusFile.type.startsWith("image/"))mediaType="image";
        else if(statusFile.type==="video/mp4")mediaType="video";
        else throw new Error("Choose a JPG, PNG, WebP image or MP4 video.");
        if(mediaType==="video" && !statusFile.type.startsWith("video/"))throw new Error("Choose an MP4 video.");
        const ext=statusFile.name.split(".").pop()||"bin";
        const key=userId+"/"+crypto.randomUUID()+"."+ext;
        const {error:uploadError}=await supabase.storage.from("connectx-status-media").upload(key,statusFile,{contentType:statusFile.type});
        if(uploadError)throw uploadError;
        mediaUrl=supabase.storage.from("connectx-status-media").getPublicUrl(key).data.publicUrl;
      }
      const {error:saveError}=await supabase.from("status_updates").insert({user_id:userId,caption:statusCaption.trim()||null,media_url:mediaUrl,media_type:mediaType});
      if(saveError)throw saveError;
      setStatusCaption("");setStatusFile(null);setShowStatusComposer(false);if(statusInputRef.current)statusInputRef.current.value="";
      await loadStatuses();setNotice("Status shared for 24 hours.");
    }catch(e){setError(e instanceof Error?e.message:"Could not publish status.");}
    finally{setBusy(false);}
  }

  async function startVoiceRecording(){
    try{
      if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==="undefined")throw new Error("Voice recording is not supported by this browser.");
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      chunksRef.current=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data);};
      recorder.onstop=()=>{const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});setVoiceBlob(blob);setVoicePreview(URL.createObjectURL(blob));stream.getTracks().forEach(t=>t.stop());};
      recorderRef.current=recorder;recorder.start();setRecording(true);
    }catch(e){setError(e instanceof Error?e.message:"Microphone access failed.");}
  }
  function stopVoiceRecording(){if(recorderRef.current?.state==="recording"){recorderRef.current.stop();setRecording(false);}}
  async function sendVoiceMessage(){
    if(!voiceBlob||!userId||!selectedFriend||busy)return;
    setBusy(true);setError("");
    try{
      const ext=voiceBlob.type.includes("mp4")?"m4a":"webm";
      const key=userId+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await supabase.storage.from("connectx-voice-notes").upload(key,voiceBlob,{contentType:voiceBlob.type});
      if(uploadError)throw uploadError;
      const url=supabase.storage.from("connectx-voice-notes").getPublicUrl(key).data.publicUrl;
      const {data,error:insertError}=await supabase.from("messages").insert({sender_id:userId,receiver_id:selectedFriend.id,content:url,message_type:"voice"}).select("id,sender_id,receiver_id,content,created_at,read_at,message_type").single();
      if(insertError)throw insertError;
      setMessages(old=>[...old,data as DirectMessage]);setVoiceBlob(null);if(voicePreview)URL.revokeObjectURL(voicePreview);setVoicePreview("");
    }catch(e){setError(e instanceof Error?e.message:"Could not send voice message.");}
    finally{setBusy(false);}
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
        .insert({ sender_id: authData.user.id, receiver_id: selectedFriend.id, content, message_type: "text" })
        .select("id,sender_id,receiver_id,content,created_at,read_at,message_type")
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
        if (typingChannel.current) void typingChannel.current.send({ type: "broadcast", event: "typing", payload: { typing: false } });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || savingProfile) return;
    const username = profileUsername.trim().replace(/^@/, "").toLowerCase();
    if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setError("Username must be 3–20 characters and use only letters, numbers or underscores.");
      return;
    }
    setSavingProfile(true); setError(""); setNotice("");
    try {
      let avatarUrl = myProfile?.avatar_url ?? null;
      if (avatarFile) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(avatarFile.type)) throw new Error("Choose a JPG, PNG or WebP image.");
        if (avatarFile.size > 5 * 1024 * 1024) throw new Error("Profile photo must be 5 MB or smaller.");
        const extension = avatarFile.type === "image/png" ? "png" : avatarFile.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage.from("connectx-avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from("connectx-avatars").getPublicUrl(path);
        avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
      }
      const updates = { full_name: profileName.trim() || null, username: username || null, bio: profileBio.trim() || null, avatar_url: avatarUrl, is_private: profilePrivate, show_last_seen: showLastSeen };
      const { data, error: updateError } = await supabase.from("profiles").update(updates).eq("id", userId)
        .select("id,username,full_name,avatar_url,bio,is_private,show_last_seen").single();
      if (updateError) throw updateError;
      setMyProfile(data as Profile);
      setProfiles((old) => old.map((profile) => profile.id === userId ? data as Profile : profile));
      setAvatarFile(null);
      setNotice("Profile updated successfully.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not update profile.";
      setError(message.includes("profiles_username_lower_unique") ? "That username is already taken. Try another one." : message);
    } finally { setSavingProfile(false); }
  }

  async function signOut() {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else window.location.href = "/";
    setBusy(false);
  }

  useEffect(() => {
    if (!userId || !selectedFriend) return;
    const channel = supabase.channel(`chat-live-${[userId, selectedFriend.id].sort().join("-")}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => setTyping(!!payload?.typing))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as DirectMessage;
        if (row.sender_id === userId && row.receiver_id === selectedFriend.id) setMessages((old) => old.map((m) => m.id === row.id ? { ...m, read_at: row.read_at } : m));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        const row = (payload.new ?? payload.old) as MessageReaction;
        if (!row?.message_id) return;
        if (payload.eventType === "DELETE") setReactions((old) => old.filter((item) => item.id !== row.id));
        else setReactions((old) => [...old.filter((item) => item.id !== row.id), row]);
      }).subscribe();
    typingChannel.current = channel;
    return () => { typingChannel.current = null; setTyping(false); void supabase.removeChannel(channel); };
  }, [userId, selectedFriend]);

  async function broadcastTyping(value: string) {
    if (!typingChannel.current) return;
    await typingChannel.current.send({ type: "broadcast", event: "typing", payload: { typing: !!value.trim() } });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (value.trim()) typingTimeout.current = setTimeout(() => {
      void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { typing: false } });
    }, 1800);
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
        {(["Messages", "Status", "Friends", "Settings"] as const).map((item, index) => (
          <button key={item} className={tab === item ? "rail-btn selected" : "rail-btn"}
            onClick={() => { setTab(item); setShowMobileChat(false); }} aria-label={item}>
            {["▤", "◉", "♙", "⚙"][index]}
          </button>
        ))}
        <div className="rail-spacer" /><div className="cx-user">{initials(myProfile?.full_name || myProfile?.username || "U")}</div>
      </aside>

      <section className={`cx-list ${showMobileChat ? "hide-mobile" : ""}`}>
        <header className="list-head">
          <div><div className="cx-brand"><span>✦</span> ConnectX</div><p>Your space to connect</p></div>
          <button className="icon-btn header-profile" aria-label="Open settings" onClick={() => { setTab("Settings"); setShowMobileChat(false); }}>{myProfile?.avatar_url ? <img src={myProfile.avatar_url} alt="" /> : initials(myProfile?.full_name || myProfile?.username || "U")}</button>
        </header>

        {tab !== "Settings" && <div className="search-row"><div className="search-box"><span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "Friends" ? "Find people by name or username" : "Search friends"} /></div><button className="refresh-btn" onClick={() => loadBase(userId).catch((e) => setError(e.message))}><span>↻</span> Refresh</button></div>}

        <div className="list-label">{tab.toUpperCase()} <span>{tab === "Friends" ? filteredProfiles.length : tab === "Messages" ? friends.length : ""}</span></div>

        {loading ? <p className="empty">Loading your account…</p> : tab === "Settings" ? (
          <form className="settings-panel profile-editor" onSubmit={saveProfile}>
            <div className="profile-photo-wrap">
              {myProfile?.avatar_url && !avatarFile ? <img className="profile-photo" src={myProfile.avatar_url} alt="Your profile" /> : <div className="large-avatar">{initials(profileName || profileUsername || "U")}</div>}
            </div>
            <label className="profile-field">Profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /></label>
            <label className="profile-field">Display name<input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={60} placeholder="Your name" /></label>
            <label className="profile-field">Username<input value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} maxLength={20} placeholder="username" autoCapitalize="none" /></label>
            <small className="profile-hint">3–20 characters · letters, numbers and underscores</small>
            <label className="profile-field">Bio<textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} maxLength={160} rows={3} placeholder="A little about you…" /></label>
            <small className="profile-hint">{profileBio.length}/160 characters</small>
            <div className="privacy-heading">PRIVACY</div>
            <label className="privacy-option"><span><strong>Private profile</strong><small>Privacy preference for future profile discovery controls</small></span><input type="checkbox" checked={profilePrivate} onChange={(e) => setProfilePrivate(e.target.checked)} /></label>
            <label className="privacy-option"><span><strong>Show last seen</strong><small>Allow friends to see your last active time when presence is added</small></span><input type="checkbox" checked={showLastSeen} onChange={(e) => setShowLastSeen(e.target.checked)} /></label>
            <button className="action-btn" type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button>
            <button className="action-btn secondary" type="button" onClick={signOut} disabled={busy || savingProfile}>Sign out</button>
          </form>
        ) : tab === "Status" ? (
          <div className="cx-chats status-panel">
            <div className="status-topbar"><div><h2>Updates</h2><p>Share what’s happening</p></div><button type="button" className="status-camera" onClick={() => setShowStatusComposer(true)} aria-label="Add status">＋</button></div>
            <div className="status-list">
              <button type="button" className="status-person my-status-row" onClick={() => myStatuses.length ? (setViewingStatusUser(userId),setViewingStatusIndex(Math.max(0,myStatuses.length-1))) : setShowStatusComposer(true)}>
                <span className="status-avatar-wrap own"><span className="status-avatar">{myProfile?.avatar_url ? <img src={myProfile.avatar_url} alt="" /> : initials(displayName(myProfile ?? {id:userId,username:null,full_name:"You",avatar_url:null}))}</span><i>＋</i></span>
                <span className="status-person-copy"><strong>My status</strong><small>{myStatuses.length ? "Tap to add another update" : "Tap to add status update"}</small></span>
                <span className="status-add-label">Add</span>
              </button>
              {myStatuses[0] && <div className="my-status-preview">{myStatuses[0].media_url ? (myStatuses[0].media_type === "video" ? "Video status" : "Photo status") : (myStatuses[0].caption || "Text status")} · {new Date(myStatuses[0].created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
            {statusGroups.length > 0 && <>
              <div className="status-section-title">RECENT UPDATES</div>
              <div className="status-list">
                {statusGroups.map(({profileId,latest,count}) => {
                  const profile = profiles.find((p) => p.id === profileId);
                  const name = profile ? displayName(profile) : "ConnectX friend";
                  return <button type="button" className="status-person" key={profileId} onClick={() => { setViewingStatusUser(profileId); setViewingStatusIndex(0); }}>
                    <span className="status-avatar-wrap unread"><span className="status-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(name)}</span></span>
                    <span className="status-person-copy"><strong>{name}</strong><small>{new Date(latest.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}{count > 1 ? ` · ${count} updates` : ""}</small></span>
                    <span className="status-kind">{latest.media_type === "video" ? "Video" : latest.media_type === "image" ? "Photo" : "Text"}</span>
                  </button>;
                })}
              </div>
            </>}
            {statuses.length === 0 && <div className="status-empty"><div className="status-empty-icon">◉</div><strong>No recent updates</strong><p>When your friends share a status, it will appear here.</p></div>}
            {viewingStatusUser && viewingStatuses[viewingStatusIndex] && <div className="status-viewer" role="dialog" aria-modal="true" onClick={() => setViewingStatusUser(null)}>
              <div className="status-viewer-content" onClick={e => e.stopPropagation()}>
                <div className="status-progress">{viewingStatuses.map((item,index)=><span key={item.id} className={index<=viewingStatusIndex?"done":""}><i /></span>)}</div>
                <div className="status-viewer-head">
                  <strong>{viewingStatusUser===userId ? "My status" : displayName(profiles.find(p=>p.id===viewingStatusUser) ?? {id:viewingStatusUser,username:null,full_name:"ConnectX friend",avatar_url:null})}</strong>
                  <small>{new Date(viewingStatuses[viewingStatusIndex].created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>
                  <button type="button" onClick={() => setViewingStatusUser(null)} aria-label="Close status">×</button>
                </div>
                <div className="status-viewer-media">
                  {viewingStatuses[viewingStatusIndex].media_type==="video" && viewingStatuses[viewingStatusIndex].media_url ? <video key={viewingStatuses[viewingStatusIndex].id} src={viewingStatuses[viewingStatusIndex].media_url} controls autoPlay playsInline /> : viewingStatuses[viewingStatusIndex].media_type==="image" && viewingStatuses[viewingStatusIndex].media_url ? <img src={viewingStatuses[viewingStatusIndex].media_url} alt="Status" /> : <p>{viewingStatuses[viewingStatusIndex].caption}</p>}
                </div>
                {viewingStatuses[viewingStatusIndex].media_type!=="text" && viewingStatuses[viewingStatusIndex].caption && <div className="status-viewer-caption">{viewingStatuses[viewingStatusIndex].caption}</div>}
                <div className="status-viewer-nav">
                  <button type="button" disabled={viewingStatusIndex===0} onClick={() => setViewingStatusIndex(i=>Math.max(0,i-1))}>‹</button>
                  <button type="button" disabled={viewingStatusIndex===viewingStatuses.length-1} onClick={() => setViewingStatusIndex(i=>Math.min(viewingStatuses.length-1,i+1))}>›</button>
                </div>
              </div>
            </div>}
            {showStatusComposer && <div className="status-modal-backdrop" onClick={() => setShowStatusComposer(false)}>
              <form className="status-compose" onSubmit={publishStatus} onClick={e => e.stopPropagation()}>
                <div className="status-compose-head"><strong>New status</strong><button type="button" onClick={() => setShowStatusComposer(false)} aria-label="Close">×</button></div>
                <textarea value={statusCaption} onChange={e=>setStatusCaption(e.target.value)} maxLength={700} placeholder="What’s on your mind?" />
                <label className="status-file">＋ Add photo or video<input ref={statusInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e=>setStatusFile(e.target.files?.[0]??null)} /></label>
                {statusFile && <small>{statusFile.name} · {(statusFile.size/1024/1024).toFixed(1)} MB</small>}
                <button className="action-btn" disabled={busy||(!statusCaption.trim()&&!statusFile)}>{busy?"Sharing…":"Share status"}</button>
              </form>
            </div>}
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
                {profile.avatar_url ? <img className="avatar" src={profile.avatar_url} alt="" /> : <span className="avatar">{initials(displayName(profile))}</span>}
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
            {selectionMode && <div className="bulk-actions"><strong>{selectedChats.length} selected</strong><button onClick={() => clearSelectedChats(false)}>Clear</button><button onClick={() => clearSelectedChats(true)}>Hide</button><button onClick={() => { setSelectionMode(false); setSelectedChats([]); }}>Cancel</button></div>}
            {friends.map((friend) => {
              return <button key={friend.id} className={`chat-row ${selectedFriend?.id === friend.id ? "active" : ""} ${selectedChats.includes(friend.id) ? "chat-selected" : ""}`}
                onTouchStart={() => beginLongPress(friend.id)} onTouchEnd={endLongPress} onTouchMove={endLongPress}
                onMouseDown={() => beginLongPress(friend.id)} onMouseUp={endLongPress} onMouseLeave={endLongPress}
                onClick={() => { if (longPressTriggered.current) { longPressTriggered.current = false; return; } chooseFriend(friend); }}>
                {friend.avatar_url ? <img className="avatar" src={friend.avatar_url} alt="" /> : <span className="avatar">{initials(displayName(friend))}</span>}
                <span className="chat-info"><strong>{displayName(friend)}</strong><small>{friend.username ? `@${friend.username}` : "Tap to open chat"}</small></span>
              </button>;
            })}
            {friends.length === 0 && <p className="empty">No friends yet. Open Friends to find people and send a request.</p>}
          </div>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Main navigation">
        <span className="nav-indicator" aria-hidden="true" style={{ transform: `translate3d(calc(${tab === "Messages" ? 0 : tab === "Status" ? 1 : tab === "Friends" ? 2 : 3} * (100% + 3px)), 0, 0)` }} />
        <button className={tab === "Messages" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Messages"); setSelectedFriend(null); setShowMobileChat(false); }}><span>◆</span>Home</button>
        <button className={tab === "Status" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Status"); setSelectedFriend(null); setShowMobileChat(false); }}><span>◉</span>Status</button>
        <button className={tab === "Friends" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Friends"); setShowMobileChat(false); }}><span>♧</span>Friends</button>
        <button className={tab === "Settings" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Settings"); setShowMobileChat(false); }}><span>⚙</span>Settings</button>
      </nav>
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
            {typing && <div className="typing-indicator"><span></span><span></span><span></span> {activeName} is typing</div>}
            {messages.map((message) => {
              const mine = message.sender_id === userId;
              return <div key={message.id} className={mine ? "message-line mine" : "message-line"}>
                <div className={mine ? "bubble mine-bubble" : "bubble"}>{message.message_type === "voice" ? <audio controls preload="metadata" src={message.content} className="voice-player" /> : <p>{message.content}</p>}
                  <small>{timeLabel(message.created_at)} {mine ? (message.read_at ? <span className="read-ticks">✓✓</span> : "✓") : ""}</small>
                  {reactions.filter((item) => item.message_id === message.id).map((item) => <button key={item.id} className="reaction-chip" onClick={() => toggleReaction(message.id, item.emoji)}>{item.emoji}{item.user_id === userId ? " · you" : ""}</button>)}
                  {reactionMessage === message.id && <div className="reaction-picker">{["👍","❤️","😂","😮","😢","🔥"].map((emoji) => <button key={emoji} onClick={() => toggleReaction(message.id, emoji)}>{emoji}</button>)}</div>}
                  <button className="react-trigger" onClick={() => setReactionMessage(reactionMessage === message.id ? null : message.id)} aria-label="React to message">☺</button>
                </div>
              </div>;
            })}
            {messages.length === 0 && <p className="empty">No messages yet. Say hello!</p>}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <button type="button" className="mic-btn" disabled={busy||!!voiceBlob} onClick={recording?stopVoiceRecording:startVoiceRecording} aria-label={recording?"Stop recording":"Record voice message"}>{recording?"■":"🎙"}</button>
            <input value={draft} onChange={(e) => { setDraft(e.target.value); void broadcastTyping(e.target.value); }} placeholder="Write a message…" maxLength={5000} />
            {recording && <span className="recording-label">Recording…</span>}
            {voiceBlob && <div className="voice-preview"><audio controls src={voicePreview} /><button type="button" onClick={()=>{setVoiceBlob(null);URL.revokeObjectURL(voicePreview);setVoicePreview("");}}>×</button><button type="button" disabled={busy} onClick={sendVoiceMessage}>Send voice</button></div>}
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
        .cx-list { width:360px;min-width:300px;min-height:0;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#121a2b;border-right:1px solid #232d42; }.list-head { flex-shrink:0; }.list-label { flex-shrink:0; }.profile-editor { padding-bottom:calc(32px + env(safe-area-inset-bottom)); }
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
        .read-ticks { color:#54b9ff;font-weight:900;letter-spacing:-3px;padding-right:3px; }.reaction-chip { margin:6px 4px 0 0;padding:4px 7px;border:1px solid #56617b;border-radius:12px;background:#27344d;color:white;font-size:11px; }.reaction-picker { display:flex;gap:4px;margin-top:7px;padding:5px;background:#101a2c;border:1px solid #45516d;border-radius:20px;width:max-content; }.reaction-picker button,.react-trigger { border:0;background:transparent;color:white;font-size:17px;cursor:pointer; }.react-trigger { display:block;margin-left:auto;font-size:13px;color:#b8c3d9; }.typing-indicator { align-self:flex-start;color:#aeb9d0;font-size:11px;display:flex;align-items:center;gap:4px; }.typing-indicator span { width:5px;height:5px;border-radius:50%;background:#a99aff;animation:typingPulse .8s infinite alternate; }.typing-indicator span:nth-child(2) { animation-delay:.2s; }.typing-indicator span:nth-child(3) { animation-delay:.4s; } @keyframes typingPulse { to { opacity:.25;transform:translateY(-3px); } }.bulk-actions { display:flex;align-items:center;gap:6px;padding:8px;position:sticky;top:0;background:#121a2b;z-index:2; }.bulk-actions strong { flex:1;font-size:11px; }.bulk-actions button { border:1px solid #46516b;border-radius:8px;padding:6px;background:#202a40;color:#fff;font-size:10px; }.chat-row.chat-selected { outline:2px solid #8e80ff;background:#28264a; }
        .back-btn { display:none;border:0;background:transparent;color:#c9bfff;font-size:28px; }.empty-state { margin:auto;color:#8490a9;text-align:center;padding:20px; }
        .section-caption { padding:14px 12px 7px;color:#77839c;font-size:9px;font-weight:800;letter-spacing:1.4px; }.request-caption { border-top:1px solid #263149;margin-top:12px; }
        .mini-btn { padding:8px 10px;font-size:10px;white-space:nowrap; }.muted-btn,.action-btn.secondary { background:#303b53;color:#d1d8e8; }
        .request-row { display:flex;align-items:center;gap:7px;padding:10px 12px;color:#dce2f2;font-size:11px; }.request-row span { flex:1; }.settings-panel { padding:24px;text-align:center; }.large-avatar { width:76px;height:76px;margin:8px auto 14px;font-size:24px;border-radius:50%;display:grid;place-items:center;background:#29334b;color:#fff; }.profile-photo-wrap { display:flex;justify-content:center;margin:8px 0 18px; }.profile-photo { width:88px;height:88px;border-radius:50%;object-fit:cover;border:2px solid #56617b; }.profile-editor { text-align:left;display:flex;flex-direction:column;gap:10px; }.profile-field { display:flex;flex-direction:column;gap:6px;text-align:left;color:#cbd5e8;font-size:12px;font-weight:600; }.profile-field input,.profile-field textarea { width:100%;box-sizing:border-box;border:1px solid #35415a;border-radius:9px;background:#111a2b;color:#f3f6ff;padding:11px;font:inherit;font-weight:400; }.profile-field input[type=file] { font-size:11px; }.profile-field textarea { resize:vertical; }.profile-hint { color:#8290aa;font-size:10px;text-align:left;margin-top:-7px; }.privacy-heading { color:#9ca9c1;font-size:10px;letter-spacing:1px;text-align:left;margin-top:12px; }.privacy-option { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid #303b53;border-radius:10px;text-align:left; }.privacy-option span { display:flex;flex-direction:column;gap:4px; }.privacy-option strong { color:#e9eefb;font-size:12px; }.privacy-option small { color:#8b96ad;font-size:10px; }.privacy-option input { accent-color:#8e80ff;width:18px;height:18px; }.action-btn { padding:12px 18px;margin-top:12px; }.toast { position:fixed;z-index:5;bottom:22px;left:50%;transform:translateX(-50%);max-width:min(92vw,560px);display:flex;gap:14px;align-items:center;padding:12px 15px;border:1px solid #3b4a65;border-radius:12px;background:#1b2940;color:#dce6ff;font-size:12px;box-shadow:0 10px 40px #0008; }.toast button { border:0;background:transparent;color:white;font-size:18px; }.error-toast { border-color:#8a4250;background:#3a202c;color:#ffd2d9; }
        @media(max-width:700px) { .cx-rail { width:54px; }.cx-list { width:calc(100% - 54px);min-width:0; }.cx-conversation { display:none; }.cx-conversation.show-mobile { display:flex;position:absolute;inset:0 0 0 54px;z-index:2; }.cx-list.hide-mobile { display:none; }.back-btn { display:block; }.conversation-head { padding:0 12px;gap:9px; }.composer { padding:12px; }.messages-area { padding:20px 14px; } }
        .header-profile img { width:100%;height:100%;object-fit:cover;border-radius:50%; }
        .search-row { display:flex;gap:12px;align-items:center;padding:0 20px 0 0; }.search-row .search-box { flex:1;margin:0 0 20px 17px; }
        .refresh-btn { flex-shrink:0;margin-bottom:20px;padding:11px 17px;border:0;border-radius:28px;background:linear-gradient(135deg,#8068e8,#7654d7);color:#fff;font-size:13px;font-weight:700;cursor:pointer; }
        .mobile-nav { display:none; }
        @media(max-width:700px) {
          .cx-shell { height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#20134f;padding-bottom:env(safe-area-inset-bottom); }
          .cx-rail { display:none; }
          .cx-list { width:100%;min-width:0;min-height:0;flex:1;border:0;background:#fff;overflow-y:auto;padding-bottom:0; }
          .list-head { padding:10px 20px 9px;min-height:82px; }
          .cx-brand { color:#211052;font-size:22px;font-weight:650;letter-spacing:-.7px; }.cx-brand span { color:#8062ed;font-size:27px;vertical-align:-2px;margin-right:4px; }
          .list-head p { color:#81799f;font-size:13px;margin-top:2px; }
          .header-profile { width:42px;height:42px;border:0;border-radius:50%;background:#8068e8;color:white;font-size:19px;box-shadow:0 0 0 8px #f1edff; }
          .search-row { padding:0 18px 0 0;gap:8px; }.search-row .search-box { margin:0 0 0 18px;padding:10px 13px;height:44px;border-radius:21px;background:#f1efff;color:#766d9b; }
          .search-box input { color:#34265e;font-size:13px; }.search-box input::placeholder { color:#777092; }
          .refresh-btn { margin:0;height:44px;padding:0 12px;border-radius:24px;font-size:12px;white-space:nowrap; }.refresh-btn span { font-size:21px;margin-right:7px;vertical-align:-2px; }
          .list-label { padding:0 20px 10px;margin-top:24px;color:#777092;font-size:11px;letter-spacing:1.4px;font-weight:600; }
          .cx-chats { flex:1;min-height:0;overflow:visible;padding:0 18px 18px; }
          .chat-row { min-height:70px;padding:10px 12px;margin:0 0 8px;border-radius:16px;background:#f8f7ff;box-shadow:0 3px 12px #3b287007;gap:10px; }
          .chat-row.active,.chat-row.chat-selected { background:#eeeaff;outline:0; }
          .avatar { width:46px;height:46px;flex:0 0 46px;border-radius:50%;background:#7659c7;font-size:15px;object-fit:cover; }
          .chat-info { flex:1;min-width:0;gap:5px; }.chat-info strong { display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;.chat-info strong { display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#30245a;font-size:13px;font-weight:550; } }.chat-info small { color:#81799f;font-size:11px; }
          .chat-row::after { content:"›";display:grid;place-items:center;.flex:0 0 32px;width:32px;height:32px;border-radius:50%;background:#f0edff;color:#654bc0;font-size:24px;font-weight:300; }
          .profile-row { flex-shrink:0;margin:8px 22px 96px;padding:13px 16px;border:1px solid #f0edff;border-radius:20px;background:#f7f6ff;box-shadow:0 5px 18px #3b287009;gap:13px; }
          .profile-avatar { width:52px;height:52px;object-fit:cover;font-size:16px; }.profile-row strong { color:#30245a;font-size:14px;font-weight:600; }.profile-row small { color:#81799f;font-size:12px; }.online-dot { color:#46bd9b;font-size:14px; }
          .mobile-nav { position:fixed;z-index:10;left:30px;right:30px;bottom:calc(9px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding:5px 6px;border-radius:22px;background:#fff;box-shadow:0 8px 35px #31205b20;border:1px solid #f4f1ff;isolation:isolate; }.nav-indicator { position:absolute;z-index:0;top:5px;bottom:5px;width:calc((100% - 21px)/4);border-radius:16px;background:#eeeaff;box-shadow:0 3px 10px #7354d71a;pointer-events:none;transition:transform 520ms cubic-bezier(.2,.85,.25,1),border-radius 220ms ease;will-change:transform; }
          .nav-item { position:relative;z-index:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 2px;border:0;border-radius:16px;background:transparent;color:#716b91;font-size:11px;font-weight:500;transform:scale(1);transition:transform 130ms cubic-bezier(.2,.8,.2,1),color 220ms ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent;will-change:transform;user-select:none; }
          .nav-item span { font-size:20px;line-height:1.1;transition:transform 220ms cubic-bezier(.2,.8,.2,1); }.nav-item.active { background:transparent;color:#7354d7;transform:scale(1); }.nav-item.active span { transform:translateY(-1px) scale(1.08); }.nav-item:active { transform:scale(.88); }.nav-item:active span { transform:scale(.94); }.mobile-nav:has(.nav-item:active) .nav-indicator { border-radius:13px; }
          .rail-btn { transition:transform 180ms cubic-bezier(.2,.8,.2,1),background-color 220ms ease,color 220ms ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent; }.rail-btn:active { transform:scale(.9); }.rail-btn.selected { transition:transform 220ms ease,background-color 220ms ease,color 220ms ease;transform:scale(1.06); }
          .cx-conversation { display:none; }.cx-conversation.show-mobile { display:flex;position:fixed;inset:0;z-index:12;background:#fff;color:#211052;padding-bottom:env(safe-area-inset-bottom); }
          .cx-list.hide-mobile { display:none; }.back-btn { display:block;border:0;background:transparent;color:#6b50cb;font-size:30px; }
          .conversation-head { padding:0 14px;gap:9px;background:#fff;border-bottom:1px solid #eeeaff;color:#211052; }.person small { color:#43b88e; }
          .messages-area { padding:20px 14px;background:#fff; }.today { background:#f1efff;color:#756b9b; }
          .bubble { background:#f0edff;color:#241653; }.mine-bubble { background:#7659dc;color:#fff; }
          .composer { padding:12px;background:#fff;border-top:1px solid #eeeaff; }.composer input { background:#f4f2ff;color:#241653;border:1px solid #e7e1ff; }
          .settings-panel { padding:16px 28px 30px; }.profile-field { color:#514774; }.profile-field input,.profile-field textarea { background:#fff;color:#241653;border-color:#ded9ef; }.privacy-option { border-color:#e8e3f5; }.privacy-option strong { color:#241653; }.privacy-option small { color:#777092; }
          .empty-state { color:#777092; }
          .status-compose { margin:0 4px 12px; }.status-card { margin:10px 4px; }
          .composer { position:relative;flex-wrap:wrap; }.voice-preview { bottom:calc(100% + 6px); }.recording-label { font-size:10px; }
          .mic-btn { flex:0 0 40px;height:40px;border:0;border-radius:50%;background:#eeeaff;color:#654bc0;font-size:18px; }
          .voice-player { width:min(230px,65vw);height:36px; }
          .voice-preview { display:flex;align-items:center;gap:6px;position:absolute;bottom:72px;left:12px;right:12px;padding:8px;border-radius:12px;background:#f3f0ff; }
          .recording-label { color:#c64d65;font-size:11px;white-space:nowrap; }
          .status-viewer { position:fixed;z-index:40;inset:0;display:flex;align-items:center;justify-content:center;padding:0;background:#09070d; }.status-viewer-content { position:relative;display:flex;width:100%;height:100%;max-width:560px;flex-direction:column;padding:env(safe-area-inset-top) 14px env(safe-area-inset-bottom);background:#09070d;color:white; }.status-progress { display:flex;gap:4px;padding-top:10px; }.status-progress span { flex:1;height:3px;overflow:hidden;border-radius:5px;background:#ffffff55; }.status-progress span.done { background:white; }.status-viewer-head { display:flex;align-items:center;gap:9px;padding:14px 2px;color:white; }.status-viewer-head strong { font-size:14px; }.status-viewer-head small { flex:1;color:#ffffffaa;font-size:11px; }.status-viewer-head button { border:0;background:transparent;color:white;font-size:30px; }.status-viewer-media { display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:hidden; }.status-viewer-media img,.status-viewer-media video { max-width:100%;max-height:100%;object-fit:contain; }.status-viewer-media p { max-width:90%;color:white;font-size:25px;line-height:1.45;text-align:center;overflow-wrap:anywhere; }.status-viewer-caption { padding:12px 8px;color:white;text-align:center;font-size:14px; }.status-viewer-nav { position:absolute;inset:52px 0 52px;display:flex;align-items:stretch;justify-content:space-between;pointer-events:none; }.status-viewer-nav button { width:25%;border:0;background:transparent;color:transparent;pointer-events:auto; }.status-viewer-nav button:disabled { pointer-events:none; }          .status-panel { overflow-y:auto;padding:0 0 100px; }.status-topbar { display:flex;align-items:center;justify-content:space-between;padding:22px 20px 16px; }.status-topbar h2 { margin:0;color:#211052;font-size:23px;font-weight:700; }.status-topbar p { margin:4px 0 0;color:#8b849f;font-size:12px; }.status-camera { width:40px;height:40px;border:0;border-radius:50%;background:#eeeaff;color:#7155d4;font-size:27px;line-height:1; }.status-list { padding:0 16px; }.status-person { display:flex;align-items:center;gap:13px;width:100%;min-height:76px;padding:10px 2px;border:0;border-bottom:1px solid #f0edf6;background:transparent;text-align:left;color:#241653; }.status-avatar-wrap { position:relative;display:grid;place-items:center;flex:0 0 54px;width:54px;height:54px;border-radius:50%; }.status-avatar-wrap.unread { padding:3px;border:2px solid #20b96b; }.status-avatar-wrap.own { padding:3px;border:2px solid #ded9e9; }.status-avatar { display:grid;place-items:center;width:100%;height:100%;overflow:hidden;border-radius:50%;background:#eeeaff;color:#7054c8;font-size:17px;font-weight:600; }.status-avatar img { width:100%;height:100%;object-fit:cover; }.status-avatar-wrap i { position:absolute;right:-2px;bottom:-1px;display:grid;place-items:center;width:21px;height:21px;border:2px solid white;border-radius:50%;background:#7659dc;color:white;font-size:16px;font-style:normal; }.status-person-copy { display:flex;flex:1;min-width:0;flex-direction:column;gap:5px; }.status-person-copy strong { overflow:hidden;color:#29213e;font-size:14px;font-weight:600;text-overflow:ellipsis;white-space:nowrap; }.status-person-copy small { color:#8d879c;font-size:12px; }.status-add-label,.status-kind { color:#8c849f;font-size:11px; }.my-status-preview { padding:0 0 12px 69px;color:#9690a5;font-size:11px; }.status-section-title { padding:22px 18px 8px;color:#817b91;font-size:11px;font-weight:700;letter-spacing:.7px; }.status-empty { display:flex;align-items:center;flex-direction:column;padding:58px 28px;text-align:center;color:#8d879c; }.status-empty-icon { display:grid;place-items:center;width:58px;height:58px;margin-bottom:14px;border-radius:50%;background:#f0edfa;color:#8067d0;font-size:25px; }.status-empty strong { color:#3b3154;font-size:14px; }.status-empty p { max-width:230px;margin:7px 0;font-size:12px;line-height:1.5; }.status-modal-backdrop { position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:#17112670; }.status-compose { display:flex;width:min(100%,480px);flex-direction:column;gap:12px;padding:18px;border:1px solid #eeeaff;border-radius:22px;background:white;box-shadow:0 12px 40px #17112625; }.status-compose-head { display:flex;align-items:center;justify-content:space-between;color:#241653;font-size:16px; }.status-compose-head button { border:0;background:transparent;color:#7b7193;font-size:26px; }.status-compose textarea { min-height:110px;padding:14px;border:1px solid #e5e0f5;border-radius:14px;resize:vertical;color:#241653;background:#faf9ff; }.status-file { padding:11px;border-radius:12px;background:#f5f2ff;color:#6855b5;font-size:13px; }.status-file input { display:block;margin-top:8px;max-width:100%;font-size:11px; }.status-compose .action-btn { width:100%; }
        }
      `}</style>
    </main>
  );
}
