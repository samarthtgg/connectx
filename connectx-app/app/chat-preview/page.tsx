"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, TouchEvent } from "react";
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
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_sender_id?: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  message_type?: "text" | "voice" | "image" | "video";
  media_path?: string | null;
  media_expires_at?: string | null;
  media_expired?: boolean;
  media_url?: string | null;
};
type StatusUpdate = { id:string; user_id:string; caption:string|null; media_url:string|null; media_type:"text"|"image"|"video"; created_at:string; expires_at:string; };
type MessageReaction = { id: string; message_id: string; user_id: string; emoji: string };
type ChatPreference = { friend_id: string; cleared_at: string | null; hidden_at: string | null; is_pinned?: boolean; is_archived?: boolean; unread_at?: string | null; draft?: string | null };
type ChatGroup = { id: string; name: string; description: string | null; created_by: string; created_at: string };
type GroupMessage = { id: string; group_id: string; sender_id: string; content: string; created_at: string; edited_at: string | null; deleted_for_everyone: boolean; reply_to_id?: string | null; reply_to_content?: string | null; reply_to_sender_id?: string | null };

const displayName = (profile: Profile) =>
  profile.full_name?.trim() || profile.username || "ConnectX user";
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ChatPreview() {
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Restore the saved preference before writing any theme value back.
  // This prevents the initial light-mode state from overwriting "dark".
  useEffect(() => {
    try {
      setDarkMode(localStorage.getItem("connectx-theme") === "dark");
    } catch {
      // Keep the default light theme when storage is unavailable.
    } finally {
      setThemeLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    try {
      localStorage.setItem("connectx-theme", darkMode ? "dark" : "light");
    } catch {
      // The app remains usable if browser storage is unavailable.
    }
  }, [darkMode, themeLoaded]);

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
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [chatPreferences, setChatPreferences] = useState<ChatPreference[]>([]);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ url: string; name: string } | null>(null);
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null);
  const [commonGroups, setCommonGroups] = useState<ChatGroup[]>([]);
  const [loadingFriendProfile, setLoadingFriendProfile] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [mutedChats, setMutedChats] = useState<string[]>([]);
  const [chatTheme, setChatTheme] = useState(0);
  const chatThemes = [
    {name:"Classic",bg:"#f7f5ff",mine:"#d9ccff",theirs:"#ffffff"}, {name:"Ocean",bg:"#eaf6ff",mine:"#b9e2ff",theirs:"#ffffff"},
    {name:"Forest",bg:"#edf7ee",mine:"#c8e8c9",theirs:"#ffffff"}, {name:"Sunset",bg:"#fff0e9",mine:"#ffd0b8",theirs:"#ffffff"},
    {name:"Rose",bg:"#fff0f4",mine:"#ffd0df",theirs:"#ffffff"}, {name:"Lavender",bg:"#f2efff",mine:"#d9d0ff",theirs:"#ffffff"},
    {name:"Midnight",bg:"#141827",mine:"#45416f",theirs:"#252b3d"}, {name:"Mint",bg:"#e9f8f3",mine:"#bdebdc",theirs:"#ffffff"},
    {name:"Sand",bg:"#f7f0e4",mine:"#ead8b8",theirs:"#ffffff"}, {name:"Graphite",bg:"#e9eaee",mine:"#cbd0dc",theirs:"#ffffff"}
  ];
  const activeChatTheme = chatThemes[chatTheme] || chatThemes[0];
  useEffect(() => { try { const saved=JSON.parse(localStorage.getItem("connectx-muted-chats")||"[]"); if(Array.isArray(saved)) setMutedChats(saved); } catch {} }, []);
  useEffect(() => { if(!selectedFriend) return; try { const n=Number(localStorage.getItem("connectx-theme-"+selectedFriend.id)); setChatTheme(Number.isInteger(n)&&n>=0&&n<10?n:0); } catch { setChatTheme(0); } }, [selectedFriend?.id]);

  const openFriendProfile = async () => {
    if (!selectedFriend) return;
    setFriendProfile(selectedFriend);
    setLoadingFriendProfile(true);
    setCommonGroups([]);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio,is_private,show_last_seen")
        .eq("id", selectedFriend.id)
        .maybeSingle();
      if (error) throw error;
      if (data) setFriendProfile(data as Profile);
      if (userId) {
        const { data: memberships, error: membershipsError } = await supabase
          .from("chat_group_members")
          .select("group_id,user_id")
          .in("user_id", [userId, selectedFriend.id]);
        if (membershipsError) throw membershipsError;
        const memberIdsByGroup = new Map<string, Set<string>>();
        for (const membership of memberships ?? []) {
          const members = memberIdsByGroup.get(membership.group_id) ?? new Set<string>();
          members.add(membership.user_id);
          memberIdsByGroup.set(membership.group_id, members);
        }
        const commonIds = Array.from(memberIdsByGroup.entries())
          .filter(([, members]) => members.has(userId) && members.has(selectedFriend.id))
          .map(([groupId]) => groupId);
        if (commonIds.length) {
          const { data: sharedGroups, error: groupsError } = await supabase
            .from("chat_groups")
            .select("id,name,description,created_by,created_at")
            .in("id", commonIds)
            .order("created_at", { ascending: false });
          if (groupsError) throw groupsError;
          setCommonGroups((sharedGroups ?? []) as ChatGroup[]);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this profile.");
    } finally {
      setLoadingFriendProfile(false);
    }
  };
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupDraft, setGroupDraft] = useState("");
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [showGroupTools, setShowGroupTools] = useState(false);
  const [groupToolTab, setGroupToolTab] = useState<"announcement"|"poll"|null>(null);
  const [groupMembers, setGroupMembers] = useState<Array<{user_id:string;role:string;joined_at:string}>>([]);
  const [groupAnnouncements, setGroupAnnouncements] = useState<Array<{id:string;author_id:string;content:string;created_at:string}>>([]);
  const [groupPolls, setGroupPolls] = useState<Array<{id:string;question:string;is_closed:boolean;allow_multiple_answers:boolean;hide_voter_names:boolean;options:Array<{id:string;label:string;votes:number;voted:boolean}>}>>([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsDraft, setPollOptionsDraft] = useState<string[]>(["", ""]);
  const [pollAllowMultipleAnswers, setPollAllowMultipleAnswers] = useState(false);
  const [pollHideVoterNames, setPollHideVoterNames] = useState(false);
  const groupPostLock = useRef(false);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditDescription, setGroupEditDescription] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; content: string; sender_id: string; kind: "direct" | "group" } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [tab, setTab] = useState<"Messages" | "Friends" | "Settings" | "Status">("Messages");
  const mainTabOrder = ["Messages", "Status", "Friends", "Settings"] as const;
  const mainTabTouchStart = useRef<{x:number;y:number}|null>(null);
  function handleMainTabTouchStart(event: TouchEvent<HTMLElement>) {
    if (window.innerWidth > 700 || (event.target as HTMLElement).closest("button,input,textarea,select,a,[role=dialog],video")) return;
    const touch = event.touches[0];
    if (touch) mainTabTouchStart.current = {x:touch.clientX,y:touch.clientY};
  }
  function handleMainTabTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = mainTabTouchStart.current;
    mainTabTouchStart.current = null;
    if (!start || window.innerWidth > 700) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    const current = mainTabOrder.indexOf(tab);
    const next = current + (dx < 0 ? 1 : -1);
    if (next < 0 || next >= mainTabOrder.length) return;
    setTab(mainTabOrder[next]);
    setSelectedFriend(null);
    setSelectedGroup(null);
    setShowMobileChat(false);
    setViewingStatusUser(null);
    setShowStatusComposer(false);
    if (mainTabOrder[next] === "Messages") void loadGroups().catch((error) => setError(error.message));
  }
  const [statuses,setStatuses]=useState<StatusUpdate[]>([]);
  const [statusCaption,setStatusCaption]=useState("");
  const [statusFile,setStatusFile]=useState<File|null>(null);
  const [showStatusComposer,setShowStatusComposer]=useState(false);
  const [viewingStatusUser,setViewingStatusUser]=useState<string|null>(null);
  const [viewingStatusIndex,setViewingStatusIndex]=useState(0);
  const [statusReactions,setStatusReactions]=useState<{id:string;status_id:string;user_id:string;emoji:string}[]>([]);
  const [statusReply,setStatusReply]=useState("");
  const [statusReplyBusy,setStatusReplyBusy]=useState(false);
  const [recording,setRecording]=useState(false);
  const [voiceBlob,setVoiceBlob]=useState<Blob|null>(null);
  const [voicePreview,setVoicePreview]=useState("");
  const recorderRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const statusInputRef=useRef<HTMLInputElement|null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!attachment) { setAttachmentPreview(""); return; }
    const previewUrl = URL.createObjectURL(attachment);
    setAttachmentPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [attachment]);

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
      supabase.from("profiles").select("id,username,full_name,avatar_url").neq("id", id).order("full_name").limit(200),
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
    () => profiles.filter((profile) => acceptedIds.has(profile.id) && !chatPreferences.find((pref) => pref.friend_id === profile.id)?.hidden_at && !chatPreferences.find((pref) => pref.friend_id === profile.id)?.is_archived)
      .sort((a, b) => Number(!!chatPreferences.find((pref) => pref.friend_id === b.id)?.is_pinned) - Number(!!chatPreferences.find((pref) => pref.friend_id === a.id)?.is_pinned)),
    [profiles, acceptedIds, chatPreferences],
  );
  const archivedFriends = useMemo(
    () => profiles.filter((profile) => acceptedIds.has(profile.id) && !!chatPreferences.find((pref) => pref.friend_id === profile.id)?.is_archived),
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
  const statusUserOrder = useMemo(() => [...(myStatuses.length ? [userId] : []), ...statusGroups.map(group => group.profileId)], [myStatuses.length, userId, statusGroups]);
  const statusTouchStartX = useRef<number | null>(null);
  function moveStatusUser(direction: -1 | 1) {
    if (!viewingStatusUser) return;
    const current = statusUserOrder.indexOf(viewingStatusUser);
    const next = current + direction;
    if (current < 0 || next < 0 || next >= statusUserOrder.length) return;
    setViewingStatusUser(statusUserOrder[next]);
    setViewingStatusIndex(0);
    setStatusReply("");
  }
  function handleStatusTouchStart(event: TouchEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button,input,textarea,a")) return;
    statusTouchStartX.current = event.touches[0]?.clientX ?? null;
  }
  function handleStatusTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = statusTouchStartX.current;
    statusTouchStartX.current = null;
    if (start === null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const delta = touch.clientX - start;
    if (Math.abs(delta) < 65) return;
    moveStatusUser(delta < 0 ? 1 : -1);
  }
  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const name = displayName(p).toLowerCase();
      const username = (p.username ?? "").toLowerCase();
      return !q || name.includes(q) || username.includes(q);
    });
  }, [profiles, search]);


  const loadGroups = useCallback(async () => {
    if (!userId) return;
    const { data: memberships, error: membershipError } = await supabase.from("chat_group_members").select("group_id").eq("user_id", userId);
    if (membershipError) throw membershipError;
    const ids = (memberships ?? []).map((row) => row.group_id as string);
    if (!ids.length) { setGroups([]); return; }
    const { data, error } = await supabase.from("chat_groups").select("id,name,description,created_by,created_at").in("id", ids).order("created_at", { ascending: false });
    if (error) throw error;
    setGroups((data ?? []) as ChatGroup[]);
  }, [userId]);
  useEffect(() => { if (userId) void loadGroups().catch((e) => setError(e.message)); }, [userId, loadGroups]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!userId || !name || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data: group, error } = await supabase.from("chat_groups").insert({ name, description: newGroupDescription.trim() || null, created_by: userId }).select("id,name,description,created_by,created_at").single();
      if (error) throw error;
      const { error: ownerError } = await supabase.from("chat_group_members").insert({ group_id: group.id, user_id: userId, role: "admin" });
      if (ownerError) throw ownerError;
      if (selectedGroupMembers.length) {
        const { error: memberError } = await supabase.from("chat_group_members").insert(selectedGroupMembers.map((id) => ({ group_id: group.id, user_id: id, role: "member" })));
        if (memberError) throw memberError;
      }
      await loadGroups();
      setSelectedGroup(null); setSelectedFriend(null);
      setShowMobileChat(false); setTab("Messages"); setShowCreateGroup(false);
      setNewGroupName(""); setNewGroupDescription(""); setSelectedGroupMembers([]);
      setNotice("Group created. Start the conversation!");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create group."); }
    finally { setBusy(false); }
  }
  async function loadGroupProfile(group: ChatGroup) {
    const membersResult = await supabase.from("chat_group_members").select("user_id,role,joined_at").eq("group_id",group.id).order("joined_at");
    if(membersResult.error) throw membersResult.error;
    setGroupMembers((membersResult.data??[]) as Array<{user_id:string;role:string;joined_at:string}>);
    setGroupEditName(group.name); setGroupEditDescription(group.description??"");
    await loadGroupFeed(group);
  }

  async function loadGroupFeed(group: ChatGroup) {
    const announcementsResult = await supabase.from("group_announcements").select("id,author_id,content,created_at").eq("group_id",group.id).order("created_at",{ascending:false}).limit(50);
    if(announcementsResult.error) throw announcementsResult.error;
    setGroupAnnouncements((announcementsResult.data??[]) as Array<{id:string;author_id:string;content:string;created_at:string}>);
    const pollsResult = await supabase.from("group_polls").select("id,question,is_closed,allow_multiple_answers,hide_voter_names").eq("group_id",group.id).order("created_at",{ascending:false}).limit(30);
    if(pollsResult.error) throw pollsResult.error;
    const rows=(pollsResult.data??[]) as Array<{id:string;question:string;is_closed:boolean;allow_multiple_answers:boolean;hide_voter_names:boolean}>;
    if(!rows.length){setGroupPolls([]);return;}
    const ids=rows.map(p=>p.id);
    const optionsResult=await supabase.from("group_poll_options").select("id,poll_id,label").in("poll_id",ids);
    if(optionsResult.error) throw optionsResult.error;
    const votesResult=await supabase.from("group_poll_votes").select("poll_id,option_id,user_id").in("poll_id",ids);
    if(votesResult.error) throw votesResult.error;
    setGroupPolls(rows.map(p=>({...p,options:(optionsResult.data??[]).filter(o=>o.poll_id===p.id).map(o=>({id:o.id,label:o.label,votes:(votesResult.data??[]).filter(v=>v.option_id===o.id).length,voted:(votesResult.data??[]).some(v=>v.option_id===o.id&&v.user_id===userId)}))})));
  }
  async function openGroupProfile(){if(!selectedGroup)return;setGroupProfileOpen(true);try{await loadGroupProfile(selectedGroup);}catch(e){setError(e instanceof Error?e.message:"Could not load group info.");}}
  async function saveGroupDetails(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selectedGroup||!groupEditName.trim())return;const {data,error}=await supabase.from("chat_groups").update({name:groupEditName.trim(),description:groupEditDescription.trim()||null,updated_at:new Date().toISOString()}).eq("id",selectedGroup.id).select("id,name,description,created_by,created_at").single();if(error){setError(error.message);return;}setSelectedGroup(data as ChatGroup);await loadGroups();setNotice("Group info updated.");}
  async function postGroupAnnouncement(){
     const content=announcementDraft.trim();
     if(!selectedGroup||!userId||!content||groupPostLock.current)return;
     const myMembership=groupMembers.find(m=>m.user_id===userId);
     if(myMembership?.role!=="admin"){setError("Only group admins can post announcements.");return;}
     groupPostLock.current=true;setBusy(true);setError("");setNotice("");
     try{
       const {data,error}=await supabase.from("group_announcements").insert({group_id:selectedGroup.id,author_id:userId,content}).select("id,author_id,content,created_at").single();
       if(error)throw error;
       setGroupAnnouncements(current=>[data as {id:string;author_id:string;content:string;created_at:string},...current]);
       setAnnouncementDraft("");setGroupToolTab(null);setShowGroupTools(false);
       setNotice("Announcement posted.");
     }catch(e){setError(e instanceof Error?e.message:"Announcement could not be posted.");}
     finally{groupPostLock.current=false;setBusy(false);}
   }
   async function createGroupPoll(){
     const question=pollQuestion.trim();
     const opts=pollOptionsDraft.map(x=>x.trim()).filter(Boolean).slice(0,10);
     if(!selectedGroup||!userId||!question||groupPostLock.current)return;
     if(opts.length<2){setError("Add at least two non-empty options.");return;}
     groupPostLock.current=true;setBusy(true);setError("");setNotice("");
     try{
       const {data,error}=await supabase.rpc("create_group_poll",{
         p_group_id:selectedGroup.id,p_question:question,p_options:opts,
         p_allow_multiple_answers:pollAllowMultipleAnswers,p_hide_voter_names:pollHideVoterNames
       });
       if(error)throw error;
       if(!data)throw new Error("The poll was not saved. Please try again.");
       await loadGroupFeed(selectedGroup);
       setPollQuestion("");setPollOptionsDraft(["",""]);setPollAllowMultipleAnswers(false);setPollHideVoterNames(false);
       setGroupToolTab(null);setShowGroupTools(false);setNotice("Poll posted.");
     }catch(e){setError(e instanceof Error?e.message:"Poll could not be posted.");}
     finally{groupPostLock.current=false;setBusy(false);}
   }
   async function voteGroupPoll(pollId:string,optionId:string){
     const p=groupPolls.find(x=>x.id===pollId);if(!p||p.is_closed||!userId)return;
     const selected=p.options.find(x=>x.id===optionId);
     let result;
     if(p.allow_multiple_answers){
       result=selected?.voted
         ? await supabase.from("group_poll_votes").delete().eq("poll_id",pollId).eq("option_id",optionId).eq("user_id",userId)
         : await supabase.from("group_poll_votes").insert({poll_id:pollId,option_id:optionId,user_id:userId});
     }else{
       const old=p.options.find(x=>x.voted);
       result=old
         ? await supabase.from("group_poll_votes").update({option_id:optionId}).eq("poll_id",pollId).eq("user_id",userId)
         : await supabase.from("group_poll_votes").insert({poll_id:pollId,option_id:optionId,user_id:userId});
     }
     if(result.error){setError(result.error.message);return;}
     await loadGroupFeed(selectedGroup!);
   }
   async function manageGroupMember(memberId:string,action:"admin"|"member"|"remove"){if(!selectedGroup)return;const query=action==="remove"?supabase.from("chat_group_members").delete().eq("group_id",selectedGroup.id).eq("user_id",memberId):supabase.from("chat_group_members").update({role:action}).eq("group_id",selectedGroup.id).eq("user_id",memberId);const {error}=await query;if(error){setError(error.message);return;}await loadGroupProfile(selectedGroup);await loadGroups();}
  async function openGroup(group: ChatGroup) {
    setSelectedGroup(group); setSelectedFriend(null); setShowMobileChat(true); setTab("Messages"); setError("");
    const { data, error } = await supabase.from("chat_group_messages").select("id,group_id,sender_id,content,created_at,edited_at,deleted_for_everyone,reply_to_id,reply_to_content,reply_to_sender_id").eq("group_id", group.id).order("created_at", { ascending: false }).limit(100);
    if (error) { setError(error.message); return; }
    setGroupMessages(((data ?? []) as GroupMessage[]).reverse());
    try { await loadGroupProfile(group); } catch (e) { setError(e instanceof Error ? e.message : "Could not load group extras."); }
  }
  function startReplySwipe(event: TouchEvent, message: { id: string; content: string; sender_id: string }, kind: "direct" | "group") {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }
  function finishReplySwipe(event: React.TouchEvent, message: { id: string; content: string; sender_id: string }, kind: "direct" | "group") {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx > 64 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      setReplyTarget({ id: message.id, content: message.content, sender_id: message.sender_id, kind });
      if (kind === "direct") setTimeout(() => document.querySelector<HTMLTextAreaElement>(".composer textarea.composer-textarea")?.focus(), 0);
      else setTimeout(() => document.querySelector<HTMLTextAreaElement>(".composer textarea.composer-textarea")?.focus(), 0);
    }
  }

  async function sendGroupMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = groupDraft.trim();
    if (!content || !selectedGroup || !userId || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.from("chat_group_messages").insert({ group_id: selectedGroup.id, sender_id: userId, content, reply_to_id: replyTarget?.kind === "group" ? replyTarget.id : null, reply_to_content: replyTarget?.kind === "group" ? replyTarget.content : null, reply_to_sender_id: replyTarget?.kind === "group" ? replyTarget.sender_id : null }).select("id,group_id,sender_id,content,created_at,edited_at,deleted_for_everyone,reply_to_id,reply_to_content,reply_to_sender_id").single();
      if (error) throw error;
      setGroupMessages((old) => [...old, data as GroupMessage]); setGroupDraft(""); setReplyTarget(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send group message."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!selectedGroup || !userId) return;
    const channel = supabase.channel("group-messages-" + selectedGroup.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_group_messages", filter: "group_id=eq." + selectedGroup.id }, (payload) => {
        const row = payload.new as GroupMessage;
        setGroupMessages((old) => old.some((item) => item.id === row.id) ? old : [...old, row]);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedGroup?.id, userId]);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    area.scrollTop = area.scrollHeight;
  }, [messages, groupMessages, selectedFriend?.id, selectedGroup?.id, showMobileChat]);

  const loadChatPreferences = useCallback(async () => {
    if (!userId) return;
    const { data, error: prefError } = await supabase.from("chat_preferences")
      .select("friend_id,cleared_at,hidden_at,is_pinned,is_archived,unread_at,draft").eq("user_id", userId);
    if (prefError) throw prefError;
    setChatPreferences((data ?? []) as ChatPreference[]);
  }, [userId]);

  useEffect(() => { if (userId) void loadChatPreferences().catch((e) => setError(e.message)); }, [userId, loadChatPreferences]);

  const loadMessages = useCallback(async (friendId: string) => {
    if (!userId) return;
    const { data, error: messageError } = await supabase.from("messages")
      .select("id,sender_id,receiver_id,content,created_at,read_at,message_type,media_path,media_expires_at,media_expired,reply_to_id,reply_to_content,reply_to_sender_id")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: false }).limit(100);
    if (messageError) throw messageError;
    const pref = chatPreferences.find((item) => item.friend_id === friendId);
    const visible = (data ?? []).filter((item) => !pref?.cleared_at || new Date(item.created_at) > new Date(pref.cleared_at));
    const messagesWithUrls = await Promise.all(visible.map(async (item) => {
      if (!item.media_path || item.media_expired || !item.media_expires_at || new Date(item.media_expires_at).getTime() <= Date.now()) {
        return { ...item, media_url: null };
      }
      const remainingSeconds = Math.max(1, Math.floor((new Date(item.media_expires_at).getTime() - Date.now()) / 1000));
      const { data: signed } = await supabase.storage.from("connectx-temporary-chat-media").createSignedUrl(item.media_path, remainingSeconds);
      return { ...item, media_url: signed?.signedUrl ?? null };
    }));
    setMessages((messagesWithUrls as DirectMessage[]).reverse());
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
    const handleDirectMessage = (payload: { new: Record<string, unknown> }) => {
      const row = payload.new as unknown as DirectMessage;
      const belongsToChat =
        (row.sender_id === userId && row.receiver_id === selectedFriend.id) ||
        (row.sender_id === selectedFriend.id && row.receiver_id === userId);
      if (!belongsToChat) return;
      void (async () => {
        let incoming = row;
        if (row.media_path && row.media_expires_at && new Date(row.media_expires_at).getTime() > Date.now()) {
          const remainingSeconds = Math.max(1, Math.floor((new Date(row.media_expires_at).getTime() - Date.now()) / 1000));
          const { data: signed } = await supabase.storage.from("connectx-temporary-chat-media").createSignedUrl(row.media_path, remainingSeconds);
          incoming = { ...row, media_url: signed?.signedUrl ?? null };
        }
        setMessages((old) => old.some((item) => item.id === incoming.id) ? old : [...old, incoming]);
      })();
    };
    // Subscribe only to rows involving this account, rather than receiving every
    // message in the project and discarding unrelated conversations on-device.
    const channel = supabase.channel(`direct-messages-${userId}-${selectedFriend.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` }, handleDirectMessage)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` }, handleDirectMessage)
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
    // Switch the active conversation type explicitly. Without clearing the
    // group selection, the group-render branch takes precedence over a friend.
    setSelectedGroup(null);
    setGroupMessages([]);
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

  async function saveChatPreference(friendId: string, patch: { cleared_at?: string | null; hidden_at?: string | null; is_pinned?: boolean; is_archived?: boolean; unread_at?: string | null; draft?: string | null }) {
    const { error: prefError } = await supabase.from("chat_preferences").upsert({
      user_id: userId, friend_id: friendId, ...patch, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,friend_id" });
    if (prefError) throw prefError;
    await loadChatPreferences();
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((old) => old.includes(messageId) ? old.filter((id) => id !== messageId) : [...old, messageId]);
  }

  async function copySelectedMessages() {
    const selected = messages.filter((message) => selectedMessageIds.includes(message.id));
    if (!selected.length) { setNotice("Select at least one message to copy."); return; }
    const text = selected.map((message) => (message.sender_id === userId ? "You" : activeName) + ": " + message.content).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(selected.length + " selected message(s) copied.");
      setSelectionMode(false);
      setSelectedMessageIds([]);
    } catch {
      setError("Could not copy selected messages. Check clipboard permission.");
    }
  }

  async function deleteSelectedMessages() {
    const selected = messages.filter((message) => selectedMessageIds.includes(message.id));
    if (!selected.length) { setNotice("Select at least one message to delete."); return; }
    const ownIds = selected.filter((message) => message.sender_id === userId).map((message) => message.id);
    const receivedCount = selected.length - ownIds.length;
    if (!ownIds.length) {
      setNotice("You can only delete messages you sent. Received messages cannot be deleted individually yet.");
      return;
    }
    try {
      const { error: deleteError } = await supabase.from("messages").delete().in("id", ownIds).eq("sender_id", userId);
      if (deleteError) throw deleteError;
      setMessages((old) => old.filter((message) => !ownIds.includes(message.id)));
      setReactions((old) => old.filter((reaction) => !ownIds.includes(reaction.message_id)));
      setSelectedMessageIds([]);
      setSelectionMode(false);
      setNotice(receivedCount
        ? ownIds.length + " sent message(s) deleted. " + receivedCount + " received message(s) were kept."
        : ownIds.length + " selected message(s) deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete selected messages.");
    }
  }

  async function togglePinnedChat(friendId: string) {
    const current = chatPreferences.find((item) => item.friend_id === friendId)?.is_pinned ?? false;
    try { await saveChatPreference(friendId, { is_pinned: !current }); setNotice(!current ? "Chat pinned." : "Chat unpinned."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update pin."); }
  }

  async function toggleArchivedChat(friendId: string) {
    const current = chatPreferences.find((item) => item.friend_id === friendId)?.is_archived ?? false;
    try {
      await saveChatPreference(friendId, { is_archived: !current });
      if (!current && selectedFriend?.id === friendId) { setSelectedFriend(null); setShowMobileChat(false); }
      setNotice(!current ? "Chat archived." : "Chat restored from archive.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not archive chat."); }
  }

  async function toggleUnreadChat(friendId: string) {
    const current = chatPreferences.find((item) => item.friend_id === friendId)?.unread_at;
    try { await saveChatPreference(friendId, { unread_at: current ? null : new Date().toISOString() }); setNotice(current ? "Chat marked as read." : "Chat marked unread."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update unread status."); }
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
    const {data,error}=await supabase.from("status_updates").select("id,user_id,caption,media_url,media_type,created_at,expires_at").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100);
    if(error)throw error; setStatuses((data??[]) as StatusUpdate[]);
  },[userId]);
  useEffect(()=>{if(userId)void loadStatuses().catch(e=>setError(e.message));},[userId,loadStatuses]);

  const activeViewedStatus = viewingStatuses[viewingStatusIndex] ?? null;
  useEffect(() => {
    if (!activeViewedStatus) { setStatusReactions([]); return; }
    let cancelled = false;
    void supabase.from("status_reactions").select("id,status_id,user_id,emoji").eq("status_id", activeViewedStatus.id).then(({data,error}) => {
      if (cancelled) return;
      if (error) setError(error.message); else setStatusReactions(data ?? []);
    });
    return () => { cancelled = true; };
  }, [activeViewedStatus?.id]);

  async function reactToStatus(emoji: string) {
    if (!userId || !activeViewedStatus || activeViewedStatus.user_id === userId) return;
    const existing = statusReactions.find(item => item.user_id === userId);
    try {
      if (existing?.emoji === emoji) {
        const {error} = await supabase.from("status_reactions").delete().eq("id", existing.id).eq("user_id", userId);
        if (error) throw error;
        setStatusReactions(old => old.filter(item => item.id !== existing.id));
      } else if (existing) {
        const {data,error} = await supabase.from("status_reactions").update({emoji}).eq("id", existing.id).eq("user_id", userId).select("id,status_id,user_id,emoji").single();
        if (error) throw error;
        setStatusReactions(old => [...old.filter(item => item.id !== existing.id), data]);
        await sendStatusReactionMessage(activeViewedStatus, emoji);
      } else {
        const {data,error} = await supabase.from("status_reactions").insert({status_id:activeViewedStatus.id,user_id:userId,emoji}).select("id,status_id,user_id,emoji").single();
        if (error) throw error;
        setStatusReactions(old => [...old,data]);
        await sendStatusReactionMessage(activeViewedStatus, emoji);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not react to status."); }
  }

  async function sendStatusReactionMessage(status: StatusUpdate, emoji: string) {
    if (!userId || !status.user_id || status.user_id === userId) return;
    const {error} = await supabase.from("messages").insert({
      sender_id:userId, receiver_id:status.user_id,
      content:"Reacted " + emoji + " to your status",
      message_type:"text",
      reply_to_id:status.id,
      reply_to_content:"STATUS_REACTION|" + (status.caption || (status.media_type === "video" ? "Video status" : status.media_type === "image" ? "Photo status" : "Status")),
      reply_to_sender_id:status.user_id
    });
    if (error) throw error;
  }

  async function sendStatusReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const status = activeViewedStatus; const content = statusReply.trim();
    if (!status || !userId || !content || status.user_id === userId || statusReplyBusy) return;
    setStatusReplyBusy(true); setError("");
    try {
      const {data,error} = await supabase.from("messages").insert({
        sender_id:userId, receiver_id:status.user_id, content, message_type:"text",
        reply_to_id:status.id,
        reply_to_content:"STATUS_REPLY|" + (status.caption || (status.media_type === "video" ? "Video status" : status.media_type === "image" ? "Photo status" : "Status")),
        reply_to_sender_id:status.user_id
      }).select("id,sender_id,receiver_id,content,created_at,read_at,message_type,reply_to_id,reply_to_content,reply_to_sender_id").single();
      if (error) throw error;
      const recipient = profiles.find(profile => profile.id === status.user_id);
      setStatusReply(""); setViewingStatusUser(null);
      if (recipient) { await chooseFriend(recipient); setMessages(old => [...old.filter(item => item.id !== data.id), data as DirectMessage]); }
      setNotice("Status reply sent.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reply to status."); }
    finally { setStatusReplyBusy(false); }
  }

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
      const {data,error:insertError}=await supabase.from("messages").insert({sender_id:userId,receiver_id:selectedFriend.id,content:url,message_type:"voice",reply_to_id:replyTarget?.kind === "direct" ? replyTarget.id : null,reply_to_content:replyTarget?.kind === "direct" ? replyTarget.content : null,reply_to_sender_id:replyTarget?.kind === "direct" ? replyTarget.sender_id : null}).select("id,sender_id,receiver_id,content,created_at,read_at,message_type,reply_to_id,reply_to_content,reply_to_sender_id").single();
      if(insertError)throw insertError;
      setMessages(old=>[...old,data as DirectMessage]);setReplyTarget(null);setVoiceBlob(null);if(voicePreview)URL.revokeObjectURL(voicePreview);setVoicePreview("");
    }catch(e){setError(e instanceof Error?e.message:"Could not send voice message.");}
    finally{setBusy(false);}
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = draft.trim();
    const file = attachment;
    if (!selectedFriend || !userId || busy) return;
    if (!content && !file) { setError("Choose a photo or enter a message before sending."); return; }
    setBusy(true); setError("");
    let uploadedPath: string | null = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user || authData.user.id !== userId) {
        throw new Error("Your active sign-in session does not match the account loaded by ConnectX. Sign out and sign in again.");
      }

      let insertPayload: Record<string, unknown> = {
        sender_id: authData.user.id,
        reply_to_id: replyTarget?.kind === "direct" ? replyTarget.id : null,
        reply_to_content: replyTarget?.kind === "direct" ? replyTarget.content : null,
        reply_to_sender_id: replyTarget?.kind === "direct" ? replyTarget.sender_id : null,
        receiver_id: selectedFriend.id,
        content,
        message_type: "text",
      };
      if (file) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
        if (!allowedTypes.includes(file.type)) throw new Error("Choose a JPG, PNG, WEBP image or MP4 video.");
        if (file.size > 20 * 1024 * 1024) throw new Error("The maximum photo/video size is 20 MB.");
        const extension = file.name.split(".").pop()?.toLowerCase() || (file.type === "video/mp4" ? "mp4" : "jpg");
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("connectx-temporary-chat-media")
          .upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        insertPayload = {
          sender_id: authData.user.id,
          receiver_id: selectedFriend.id,
          reply_to_id: replyTarget?.kind === "direct" ? replyTarget.id : null,
          reply_to_content: replyTarget?.kind === "direct" ? replyTarget.content : null,
          reply_to_sender_id: replyTarget?.kind === "direct" ? replyTarget.sender_id : null,
          content: content || file.name,
          message_type: file.type.startsWith("video/") ? "video" : "image",
          media_path: uploadedPath,
          media_expires_at: expiresAt,
          media_expired: false,
        };
      }

      const { data, error: insertError } = await supabase.from("messages").insert(insertPayload)
        .select("id,sender_id,receiver_id,content,created_at,read_at,message_type,media_path,media_expires_at,media_expired,reply_to_id,reply_to_content,reply_to_sender_id")
        .single();
      if (insertError) throw insertError;
      if (data) {
        let sentMessage = data as DirectMessage;
        if (sentMessage.media_path && sentMessage.media_expires_at) {
          const { data: signed } = await supabase.storage.from("connectx-temporary-chat-media")
            .createSignedUrl(sentMessage.media_path, Math.max(1, Math.floor((new Date(sentMessage.media_expires_at).getTime() - Date.now()) / 1000)));
          sentMessage = { ...sentMessage, media_url: signed?.signedUrl ?? null };
        }
        setMessages((old) => old.some((item) => item.id === sentMessage.id) ? old : [...old, sentMessage]);
        setDraft("");
        setReplyTarget(null);
        setAttachment(null);
        if (attachmentInputRef.current) attachmentInputRef.current.value = "";
        if (typingChannel.current) void typingChannel.current.send({ type: "broadcast", event: "typing", payload: { typing: false } });
      }
    } catch (reason) {
      if (uploadedPath) await supabase.storage.from("connectx-temporary-chat-media").remove([uploadedPath]);
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
    <main className="cx-shell" data-theme={darkMode ? "dark" : "light"}>
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

      <section className={`cx-list ${showMobileChat ? "hide-mobile" : ""}`} onTouchStart={handleMainTabTouchStart} onTouchEnd={handleMainTabTouchEnd}>
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
            <div className="privacy-heading">APPEARANCE</div>
            <label className="privacy-option"><span><strong>Dark mode</strong><small>Use a darker theme across ConnectX</small></span><input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} /></label>
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
              <div className="status-viewer-content" onClick={e => e.stopPropagation()} onTouchStart={handleStatusTouchStart} onTouchEnd={handleStatusTouchEnd}>
                <div className="status-progress">{viewingStatuses.map((item,index)=><span key={item.id} className={index<=viewingStatusIndex?"done":""}><i /></span>)}</div>
                <div className="status-viewer-head">
                  <button type="button" className="status-user-swipe-prev" onClick={() => moveStatusUser(-1)} disabled={statusUserOrder.indexOf(viewingStatusUser) <= 0} aria-label="Previous friend status">‹</button>
                  <strong>{viewingStatusUser===userId ? "My status" : displayName(profiles.find(p=>p.id===viewingStatusUser) ?? {id:viewingStatusUser,username:null,full_name:"ConnectX friend",avatar_url:null})}</strong>
                  <small>{new Date(viewingStatuses[viewingStatusIndex].created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>
                  <button type="button" className="status-user-swipe-next" onClick={() => moveStatusUser(1)} disabled={statusUserOrder.indexOf(viewingStatusUser) >= statusUserOrder.length-1} aria-label="Next friend status">›</button>
                  <button type="button" onClick={() => setViewingStatusUser(null)} aria-label="Close status">×</button>
                </div>
                <div className="status-viewer-media">
                  {viewingStatuses[viewingStatusIndex].media_type==="video" && viewingStatuses[viewingStatusIndex].media_url ? <video key={viewingStatuses[viewingStatusIndex].id} src={viewingStatuses[viewingStatusIndex].media_url} controls autoPlay playsInline /> : viewingStatuses[viewingStatusIndex].media_type==="image" && viewingStatuses[viewingStatusIndex].media_url ? <img src={viewingStatuses[viewingStatusIndex].media_url} alt="Status" /> : <p>{viewingStatuses[viewingStatusIndex].caption}</p>}
                </div>
                {viewingStatuses[viewingStatusIndex].media_type!=="text" && viewingStatuses[viewingStatusIndex].caption && <div className="status-viewer-caption">{viewingStatuses[viewingStatusIndex].caption}</div>}
                {viewingStatusUser !== userId && <div className="status-interaction-bar" onClick={e => e.stopPropagation()}>
                  <div className="status-emoji-bar" aria-label="React to status">
                    {["❤️","😂","😮","😢","🙏","🔥","👏","👍"].map(emoji => <button type="button" key={emoji} className={statusReactions.some(item => item.user_id === userId && item.emoji === emoji) ? "selected" : ""} onClick={() => void reactToStatus(emoji)} aria-label={"React "+emoji}>{emoji}</button>)}
                  </div>
                  <form className="status-reply-form" onSubmit={sendStatusReply}>
                    <input value={statusReply} onChange={e => setStatusReply(e.target.value)} placeholder="Reply to status…" maxLength={1000} aria-label="Reply to status" />
                    <button type="submit" disabled={!statusReply.trim() || statusReplyBusy} aria-label="Send status reply">{statusReplyBusy ? "…" : "➤"}</button>
                  </form>
                </div>}
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
            <div className="groups-heading"><strong>GROUPS</strong><button type="button" className="mini-btn" onClick={() => setShowCreateGroup(true)}>＋ Create group</button></div>
            {groups.map((group) => <button type="button" className="group-row" key={group.id} onClick={() => void openGroup(group)}><span className="group-avatar">♧</span><span className="chat-info"><strong>{group.name}</strong><small>{group.description || "Group conversation"}</small></span></button>)}
            {groups.length === 0 && <p className="group-empty">No groups yet. Create one and invite your friends.</p>}
            {showCreateGroup && <div className="status-modal-backdrop" onClick={() => setShowCreateGroup(false)}><form className="status-compose" onSubmit={createGroup} onClick={(e) => e.stopPropagation()}><div className="status-compose-head"><strong>Create a group</strong><button type="button" onClick={() => setShowCreateGroup(false)}>×</button></div><label className="profile-field">Group name<input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={60} required placeholder="e.g. Project team" /></label><label className="profile-field">Description<input value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} maxLength={300} placeholder="Optional description" /></label><div className="section-caption">ADD FRIENDS</div>{friends.map((friend) => <label className="privacy-option" key={friend.id}><span><strong>{displayName(friend)}</strong></span><input type="checkbox" checked={selectedGroupMembers.includes(friend.id)} onChange={(e) => setSelectedGroupMembers((old) => e.target.checked ? [...old, friend.id] : old.filter((id) => id !== friend.id))} /></label>)}<button className="action-btn" disabled={busy || !newGroupName.trim()}>{busy ? "Creating…" : "Create group"}</button></form></div>}
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
            {groups.length > 0 && <>
              <div className="groups-heading"><strong>GROUPS</strong><span>{groups.length}</span></div>
              {groups.map((group) => (
                <button type="button" className="group-row" key={group.id} onClick={() => void openGroup(group)}>
                  <span className="group-avatar">♧</span>
                  <span className="chat-info"><strong>{group.name}</strong><small>{group.description || "Group conversation"}</small></span>
                </button>
              ))}
            </>}
            <div className="section-caption">CHATS <button type="button" className="text-btn" onClick={() => setShowArchivedChats((value) => !value)}>{showArchivedChats ? "Back to chats" : "Archive (" + archivedFriends.length + ")"}</button></div>
            {(showArchivedChats ? archivedFriends : friends).map((friend) => {
              const preference = chatPreferences.find((item) => item.friend_id === friend.id);
              return <div className="chat-row-wrap" key={friend.id}>
              <button className={`chat-row ${selectedFriend?.id === friend.id ? "active" : ""} ${selectedChats.includes(friend.id) ? "chat-selected" : ""}`}
                onTouchStart={() => beginLongPress(friend.id)} onTouchEnd={endLongPress} onTouchMove={endLongPress}
                onMouseDown={() => beginLongPress(friend.id)} onMouseUp={endLongPress} onMouseLeave={endLongPress}
                onClick={() => { if (longPressTriggered.current) { longPressTriggered.current = false; return; } chooseFriend(friend); }}>
                {friend.avatar_url ? <img className="avatar chat-row-photo" src={friend.avatar_url} alt={`${displayName(friend)} profile photo`} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); setPhotoViewer({ url: friend.avatar_url!, name: displayName(friend) }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setPhotoViewer({ url: friend.avatar_url!, name: displayName(friend) }); } }} /> : <span className="avatar">{initials(displayName(friend))}</span>}
                <span className="chat-info"><strong>{preference?.is_pinned ? "📌 " : ""}{displayName(friend)}{preference?.unread_at ? " •" : ""}</strong><small>{friend.username ? `@${friend.username}` : "Tap to open chat"}{preference?.unread_at ? " · Unread" : ""}</small></span>
              </button>
              <div className="chat-row-tools">
                <button type="button" className="text-btn" onClick={() => void togglePinnedChat(friend.id)}>{preference?.is_pinned ? "Unpin" : "Pin"}</button>
                <button type="button" className="text-btn" onClick={() => void toggleUnreadChat(friend.id)}>{preference?.unread_at ? "Mark read" : "Unread"}</button>
                <button type="button" className="text-btn" onClick={() => void toggleArchivedChat(friend.id)}>{preference?.is_archived ? "Restore" : "Archive"}</button>
              </div>
              </div>;
            })}
            {(showArchivedChats ? archivedFriends : friends).length === 0 && <p className="empty">{showArchivedChats ? "No archived chats." : "No friends yet. Open Friends to find people and send a request."}</p>}
          </div>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Main navigation">
        <span className="nav-indicator" aria-hidden="true" style={{ transform: `translate3d(calc(${tab === "Messages" ? 0 : tab === "Status" ? 1 : tab === "Friends" ? 2 : 3} * (100% + 3px)), 0, 0)` }} />
        <button className={tab === "Messages" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Messages"); setSelectedFriend(null); setSelectedGroup(null); setShowMobileChat(false); void loadGroups().catch((e) => setError(e.message)); }}><span>◆</span>Home</button>
        <button className={tab === "Status" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Status"); setSelectedFriend(null); setShowMobileChat(false); }}><span>◉</span>Status</button>
        <button className={tab === "Friends" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Friends"); setShowMobileChat(false); }}><span>♧</span>Friends</button>
        <button className={tab === "Settings" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Settings"); setShowMobileChat(false); }}><span>⚙</span>Settings</button>
      </nav>
      <section className={`cx-conversation ${showMobileChat ? "show-mobile" : ""}`}>
        {selectedGroup && tab === "Messages" ? <>
          <header className="conversation-head"><button className="back-btn" onClick={() => setShowMobileChat(false)}>‹</button><button type="button" className="profile-open-avatar" onClick={() => void openGroupProfile()} aria-label="Open group info"><span className="avatar">♧</span></button><button type="button" className="person profile-open-name" onClick={() => void openGroupProfile()}><strong>{selectedGroup.name}</strong><small>Tap for group info</small></button><button type="button" className="call-icon" onClick={() => void openGroupProfile()} aria-label="Group info">ⓘ</button></header>
          <div className="messages-area" ref={messagesAreaRef}><div className="today">GROUP MESSAGES</div>{groupAnnouncements.map(a=><article className="group-feed-card" key={"announcement-"+a.id}><strong>📢 Announcement</strong><p>{a.content}</p><small>{profiles.find(p=>p.id===a.author_id)?displayName(profiles.find(p=>p.id===a.author_id)!):"Group admin"} · {timeLabel(a.created_at)}</small></article>)}{groupPolls.map(p=><article className="group-feed-card" key={"poll-"+p.id}><strong>📊 {p.question}</strong>{p.options.map(o=><button type="button" key={o.id} disabled={p.is_closed} className={o.voted?"group-poll-option voted":"group-poll-option"} onClick={()=>void voteGroupPoll(p.id,o.id)}><span>{o.label}</span><span>{o.votes}{o.voted?" ✓":""}</span></button>)}<small>{p.is_closed?"Poll closed":p.allow_multiple_answers?"Select all that apply":"Tap an option to vote"}</small></article>)}{groupMessages.filter((m) => !m.deleted_for_everyone).map((m) => <div key={m.id} className={m.sender_id === userId ? "message-line mine" : "message-line"} onTouchStart={(e) => startReplySwipe(e, m, "group")} onTouchEnd={(e) => finishReplySwipe(e, m, "group")}><div className={m.sender_id === userId ? "bubble mine-bubble" : "bubble"}>{m.reply_to_content && <div className="reply-quote"><strong>{m.reply_to_sender_id === userId ? "You" : "Replied message"}</strong><span>{m.reply_to_content}</span></div>}<p>{m.content}</p><small>{m.sender_id === userId ? "You · " : "Member · "}{timeLabel(m.created_at)}</small></div></div>)}{groupMessages.length === 0 && <p className="empty">This group is ready. Send the first message.</p>}</div>
          {showGroupTools && <div className="group-action-backdrop" onClick={()=>{setShowGroupTools(false);setGroupToolTab(null);}}><section className="group-tools-panel" role="dialog" aria-modal="true" aria-label="Group actions" onClick={e=>e.stopPropagation()}><div className="group-tools-panel-head"><div><strong>{groupToolTab==="announcement"?"New announcement":groupToolTab==="poll"?"Create a poll":"Group actions"}</strong><small>{groupToolTab?"Share something with everyone in this group":"Choose what you want to post"}</small></div><button type="button" aria-label="Close group actions" onClick={()=>{setShowGroupTools(false);setGroupToolTab(null);}}>×</button></div>{!groupToolTab && <div className="group-tools-tabs"><button type="button" onClick={()=>setGroupToolTab("announcement")} disabled={groupMembers.find(m=>m.user_id===userId)?.role!=="admin"}><span>📢</span><strong>Announcement</strong><small>Important message for members</small></button><button type="button" onClick={()=>setGroupToolTab("poll")}><span>📊</span><strong>Poll</strong><small>Ask members to vote</small></button></div>}{groupToolTab==="announcement" && <div className="group-tool-editor"><label>Announcement message</label><textarea rows={4} maxLength={2000} value={announcementDraft} onChange={e=>setAnnouncementDraft(e.target.value)} placeholder="Write your announcement…" /><button type="button" className="action-btn" disabled={!announcementDraft.trim()||busy} onClick={()=>void postGroupAnnouncement()}>{busy?"Posting…":"Post announcement"}</button></div>}{groupToolTab==="poll" && <div className="group-tool-editor poll-editor">
<label htmlFor="group-poll-question">Question</label><input id="group-poll-question" autoFocus value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} maxLength={255} placeholder="Ask a question" /><small className="poll-counter">{pollQuestion.length}/255</small>
<label>Options <small>2–10 options</small></label><div className="poll-option-fields">{pollOptionsDraft.map((option,index)=><div className="poll-option-row" key={index}><input aria-label={"Option "+(index+1)} value={option} maxLength={100} onChange={e=>setPollOptionsDraft(current=>current.map((item,i)=>i===index?e.target.value:item))} placeholder={"Option "+(index+1)} />{pollOptionsDraft.length>2&&<button type="button" className="poll-remove-option" aria-label={"Remove option "+(index+1)} onClick={()=>setPollOptionsDraft(current=>current.filter((_,i)=>i!==index))}>×</button>}</div>)}</div>
{pollOptionsDraft.length<10&&<button type="button" className="poll-add-option" onClick={()=>setPollOptionsDraft(current=>[...current,""])}>＋ Add option</button>}
<div className="poll-setting-row"><span>Allow multiple answers</span><input type="checkbox" checked={pollAllowMultipleAnswers} onChange={e=>setPollAllowMultipleAnswers(e.target.checked)} /></div><div className="poll-setting-row"><span>Hide voter names</span><input type="checkbox" checked={pollHideVoterNames} onChange={e=>setPollHideVoterNames(e.target.checked)} /></div>
<button type="button" className="action-btn poll-send-btn" disabled={!pollQuestion.trim()||pollOptionsDraft.filter(x=>x.trim()).length<2||busy} onClick={()=>void createGroupPoll()}>{busy?"Sending…":"➤ Send poll"}</button></div>}</section></div>}<form className="composer group-composer" onSubmit={sendGroupMessage}>{replyTarget?.kind === "group" && <div className="reply-compose"><span><strong>Replying to {replyTarget.sender_id === userId ? "yourself" : "message"}</strong><small>{replyTarget.content}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}<button type="button" className="group-more-btn" aria-label="More group actions" onClick={()=>{setShowGroupTools(v=>!v);setGroupToolTab(null);}}>⋮</button><textarea className="composer-textarea" rows={1} value={groupDraft} onChange={(e) => { setGroupDraft(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, window.innerHeight * 0.35)}px`; }} placeholder="Message the group…" maxLength={5000} aria-label="Group message" /><button className="send" disabled={!groupDraft.trim() || busy}>➤</button></form>
        </> : selectedFriend && tab === "Messages" ? <>
          <header className="conversation-head">
            <button className="back-btn" onClick={() => setShowMobileChat(false)}>‹</button>
            <button type="button" className="profile-open-avatar" aria-label={"View " + activeName + "'s profile"} onClick={() => void openFriendProfile()}>
              {selectedFriend.avatar_url ? <img className="avatar chat-header-avatar" src={selectedFriend.avatar_url} alt="" /> : <span className="avatar chat-header-avatar">{initials(activeName)}</span>}
            </button>
            <button type="button" className="person profile-open-name" onClick={() => void openFriendProfile()} aria-label={"View " + activeName + "'s profile"}><strong>{activeName}</strong><small>View profile</small></button>
            <div className="call-actions">
              <button className="call-icon" title="Audio call" aria-label="Start audio call" disabled={!!activeCall || !!incomingCall} onClick={() => startCall("audio")}>☎</button>
              <button className="call-icon" title="Video call" aria-label="Start video call" disabled={!!activeCall || !!incomingCall} onClick={() => startCall("video")}>▣</button>
              <div className="chat-more-wrap"><button type="button" className="call-icon" aria-label="More chat options" onClick={() => setChatMenuOpen(v=>!v)}>⋮</button>
                {chatMenuOpen && <div className="chat-more-menu">
                  <button onClick={() => {setMessageSelectionMode(true);setSelectedMessageIds([]);setChatMenuOpen(false);setNotice("Tap individual messages to select them.");}}>☑ Select messages</button>
                  <button onClick={() => {setThemePickerOpen(v=>!v);setChatMenuOpen(false);}}>🎨 Chat theme</button>
                  <button onClick={() => {setChatSearchOpen(v=>!v);setChatSearch("");setChatMenuOpen(false);}}>⌕ Search messages</button>
                  <button onClick={() => {const next=mutedChats.includes(selectedFriend!.id)?mutedChats.filter(x=>x!==selectedFriend!.id):[...mutedChats,selectedFriend!.id];setMutedChats(next);try{localStorage.setItem("connectx-muted-chats",JSON.stringify(next));}catch{}setNotice(next.includes(selectedFriend!.id)?"Chat muted on this device.":"Chat unmuted.");setChatMenuOpen(false);}}>{mutedChats.includes(selectedFriend!.id)?"🔔 Unmute chat":"🔕 Mute notifications"}</button>
                  <button onClick={() => {const t=messages.map(m=>(m.sender_id===userId?"You":activeName)+": "+m.content).join("\n");void navigator.clipboard.writeText(t).then(()=>setNotice("Chat copied.")).catch(()=>setError("Clipboard access failed."));setChatMenuOpen(false);}}>▣ Copy chat</button>
                  <button onClick={() => {const t=messages.map(m=>(m.sender_id===userId?"You":activeName)+": "+m.content).join("\n");const u=URL.createObjectURL(new Blob([t],{type:"text/plain"}));const a=document.createElement("a");a.href=u;a.download="ConnectX-chat.txt";a.click();URL.revokeObjectURL(u);setChatMenuOpen(false);}}>↓ Export chat</button>
                  <button className="danger-option" onClick={() => {void saveChatPreference(selectedFriend!.id,{cleared_at:new Date().toISOString()}).then(()=>{setMessages([]);setReactions([]);setNotice("Chat cleared.");}).catch(e=>setError(e.message));setChatMenuOpen(false);}}>⌫ Clear chat</button>
                </div>}</div>
            </div>
          </header>
          {themePickerOpen && <div className="chat-theme-panel"><div className="chat-theme-heading"><strong>Chat theme · swipe to browse</strong><button onClick={()=>setThemePickerOpen(false)}>×</button></div>
            <div className="chat-theme-carousel">{chatThemes.map((theme,index)=><button type="button" key={theme.name} className={chatTheme===index?"chat-theme-choice chosen":"chat-theme-choice"} onClick={()=>{setChatTheme(index);try{localStorage.setItem("connectx-theme-"+selectedFriend.id,String(index));}catch{}}}>
              <span className="theme-preview" style={{background:theme.bg}}><i style={{background:theme.theirs}}/><i style={{background:theme.mine}}/><i style={{background:theme.mine}}/></span><small>{theme.name}</small></button>)}</div></div>}
          {chatSearchOpen && <div className="chat-search-bar"><input autoFocus value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Search messages in this chat"/><button onClick={()=>{setChatSearchOpen(false);setChatSearch("");}}>×</button><small>{messages.filter(m=>m.content.toLowerCase().includes(chatSearch.toLowerCase())).length} found</small></div>}
          {messageSelectionMode && <div className="bulk-actions message-selection-toolbar">
            <strong>{selectedMessageIds.length} message(s) selected</strong>
            <button type="button" disabled={!selectedMessageIds.length} onClick={() => void copySelectedMessages()}>Copy</button>
            <button type="button" className="danger-option" disabled={!selectedMessageIds.length} onClick={() => void deleteSelectedMessages()}>Delete</button>
            <button type="button" onClick={() => { setMessageSelectionMode(false); setSelectedMessageIds([]); }}>Cancel</button>
          </div>}
          <div className="messages-area" ref={messagesAreaRef} style={{background:activeChatTheme.bg}}>
            <div className="today">DIRECT MESSAGES</div>
            {typing && <div className="typing-indicator"><span></span><span></span><span></span> {activeName} is typing</div>}
            {messages.filter(m=>!chatSearch.trim() || m.content.toLowerCase().includes(chatSearch.toLowerCase())).map((message) => {
              const mine = message.sender_id === userId;
              const mediaIsExpired = !!message.media_path && (message.media_expired === true || !message.media_expires_at || new Date(message.media_expires_at).getTime() <= Date.now());
              return <div key={message.id} className={(mine ? "message-line mine" : "message-line") + (selectedMessageIds.includes(message.id) ? " message-selected" : "")} onClick={() => { if (messageSelectionMode) toggleMessageSelection(message.id); }} onTouchStart={(e) => { if (!messageSelectionMode) startReplySwipe(e, message, "direct"); }} onTouchEnd={(e) => { if (!messageSelectionMode) finishReplySwipe(e, message, "direct"); }}>
                <div className={mine ? "bubble mine-bubble" : "bubble"} style={{background:mine?activeChatTheme.mine:activeChatTheme.theirs,color:chatTheme===6?"#f4f2ff":"#25233a"}}>{message.reply_to_content && <div className="reply-quote"><strong>{message.reply_to_content.startsWith("STATUS_REPLY|") ? "Replied to your status" : message.reply_to_content.startsWith("STATUS_REACTION|") ? "Reacted to your status" : message.reply_to_sender_id === userId ? "You" : "Replied message"}</strong><span>{message.reply_to_content.replace(/^STATUS_(?:REPLY|REACTION)\|/, "")}</span></div>}{message.message_type === "voice" ? <audio controls preload="metadata" src={message.content} className="voice-player" /> : message.message_type === "image" ? (mediaIsExpired || !message.media_url ? <p className="expired-media">This photo has expired.</p> : <img className="chat-media" src={message.media_url} alt="Shared photo" />) : message.message_type === "video" ? (mediaIsExpired || !message.media_url ? <p className="expired-media">This video has expired.</p> : <video className="chat-media" src={message.media_url} controls playsInline preload="metadata" />) : <p>{message.content}</p>}
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
            {replyTarget?.kind === "direct" && <div className="reply-compose"><span><strong>Replying to {replyTarget.sender_id === userId ? "yourself" : activeName}</strong><small>{replyTarget.content}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}
            <label className="attach-btn" aria-label="Attach photo or video">＋
              <input ref={attachmentInputRef} className="attachment-input" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={!!voiceBlob} onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) { setError("The maximum photo/video size is 20 MB."); event.target.value = ""; return; }
                if (!["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(file.type)) { setError("Choose a JPG, PNG, WEBP image or MP4 video."); event.target.value = ""; return; }
                setError(""); setAttachment(file);
              }} />
            </label>
            <button type="button" className="mic-btn" disabled={busy||!!voiceBlob||!!attachment} onClick={recording?stopVoiceRecording:startVoiceRecording} aria-label={recording?"Stop recording":"Record voice message"}>{recording?"■":"🎙"}</button>
            <textarea className="composer-textarea" rows={1} value={draft} onChange={(e) => { setDraft(e.target.value); void broadcastTyping(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, window.innerHeight * 0.35)}px`; }} placeholder={attachment ? "Add a caption (optional)…" : "Write a message…"} maxLength={5000} aria-label="Message" />
            {attachment && <div className="attachment-preview">
              {attachment.type.startsWith("image/") ? <img src={attachmentPreview} alt="Selected attachment preview" /> : <video src={attachmentPreview} muted playsInline />}
              <span>{attachment.name}</span>
              <button type="button" aria-label="Remove attachment" onClick={() => { setAttachment(null); if (attachmentInputRef.current) attachmentInputRef.current.value = ""; }}>×</button>
            </div>}
            {recording && <span className="recording-label">Recording…</span>}
            {voiceBlob && <div className="voice-preview"><audio controls src={voicePreview} /><button type="button" onClick={()=>{setVoiceBlob(null);URL.revokeObjectURL(voicePreview);setVoicePreview("");}}>×</button><button type="button" disabled={busy} onClick={sendVoiceMessage}>Send voice</button></div>}
            <button type="button" className="send" disabled={busy || !selectedFriend || !userId} onClick={() => void sendMessage()} aria-label="Send message">{busy ? "…" : "➤"}</button>
          </form>
        </> : <div className="empty-state">{tab === "Friends" ? "Find people and build your friends list." : "Choose a friend to start messaging."}</div>}
      </section>

      {groupProfileOpen && selectedGroup && <div className="profile-modal-backdrop group-profile-backdrop" onClick={() => setGroupProfileOpen(false)}>
        <section className="friend-profile-card group-profile-card" role="dialog" aria-modal="true" aria-label="Group info" onClick={event => event.stopPropagation()}>
          <header className="friend-profile-topbar"><button type="button" onClick={() => setGroupProfileOpen(false)} aria-label="Back">‹</button><strong>Group info</strong><span className="group-info-header-spacer" /></header>
          <div className="group-profile-hero"><div className="group-profile-avatar">♧</div><h2>{selectedGroup.name}</h2><p>{groupMembers.length} participants</p><small>Created {new Date(selectedGroup.created_at).toLocaleDateString()}</small></div>
          <div className="group-profile-section"><small>ABOUT</small><p>{selectedGroup.description?.trim() || "No description yet. Group admins can add one in Group settings."}</p></div>
          {groupMembers.some(m=>m.user_id===userId&&m.role==="admin") && <div className="group-profile-section"><small>GROUP SETTINGS</small><form className="group-profile-form" onSubmit={saveGroupDetails}><input value={groupEditName} onChange={e=>setGroupEditName(e.target.value)} placeholder="Group name" maxLength={80} required/><textarea value={groupEditDescription} onChange={e=>setGroupEditDescription(e.target.value)} placeholder="Description" maxLength={500} rows={3}/><button className="action-btn" type="submit">Save info</button></form></div>}
          <div className="group-profile-section"><div className="group-participant-heading"><small>PARTICIPANTS · {groupMembers.length}</small><span>{groupMembers.filter(m=>m.role==="admin").length} admins</span></div>
            {groupMembers.map(member=>{const person=profiles.find(p=>p.id===member.user_id);const name=person?displayName(person):"ConnectX member";const admin=member.role==="admin";const canManage=groupMembers.some(m=>m.user_id===userId&&m.role==="admin")&&member.user_id!==userId&&member.user_id!==selectedGroup.created_by;return <div className="group-profile-member" key={member.user_id}><span className="group-member-avatar">{person?.avatar_url?<img src={person.avatar_url} alt=""/>:initials(name)}</span><span className="group-member-name"><strong>{name}{member.user_id===userId?" (You)":""}</strong><small>{admin?"Group admin":"Participant"}</small></span>{canManage&&<div className="group-member-actions"><button type="button" className="text-btn" onClick={()=>void manageGroupMember(member.user_id,admin?"member":"admin")}>{admin?"Remove admin":"Make admin"}</button><button type="button" className="text-btn" onClick={()=>void manageGroupMember(member.user_id,"remove")}>Remove</button></div>}</div>})}
            {groupMembers.some(m=>m.user_id===userId&&m.role==="admin")&&<div className="group-add-members"><strong>Add participants</strong>{friends.filter(f=>!groupMembers.some(m=>m.user_id===f.id)).map(f=><button type="button" className="text-btn" key={f.id} onClick={async()=>{const {error}=await supabase.from("chat_group_members").insert({group_id:selectedGroup.id,user_id:f.id,role:"member"});if(error)setError(error.message);else await loadGroupProfile(selectedGroup);}}>＋ {displayName(f)}</button>)}</div>}
          </div>
        </section>
      </div>}
      {friendProfile && <div className="profile-modal-backdrop" role="presentation" onClick={() => setFriendProfile(null)}>
        <section className="friend-profile-card" role="dialog" aria-modal="true" aria-label={displayName(friendProfile) + " contact info"} onClick={(event) => event.stopPropagation()}>
          <header className="friend-profile-topbar"><button type="button" onClick={() => setFriendProfile(null)} aria-label="Close contact info">‹</button><strong>Contact info</strong><span /></header>
          <div className="friend-profile-identity">
            <button type="button" className="friend-profile-avatar" onClick={() => friendProfile.avatar_url && setPhotoViewer({url:friendProfile.avatar_url,name:displayName(friendProfile)})} aria-label="View profile photo">
              {friendProfile.avatar_url ? <img src={friendProfile.avatar_url} alt={displayName(friendProfile) + " profile photo"} /> : <span>{initials(displayName(friendProfile))}</span>}
            </button>
            <h2>{displayName(friendProfile)}</h2>
            {friendProfile.username && <p className="friend-profile-username">@{friendProfile.username}</p>}
            <small>{loadingFriendProfile ? "Loading profile…" : "ConnectX friend"}</small>
            <div className="friend-profile-actions">
              <button type="button" onClick={() => setFriendProfile(null)}><span>▣</span>Message</button>
              <button type="button" onClick={() => { setFriendProfile(null); void startCall("audio"); }}><span>☎</span>Audio</button>
              <button type="button" onClick={() => { setFriendProfile(null); void startCall("video"); }}><span>▣</span>Video</button>
            </div>
          </div>
          <div className="friend-profile-section">
            <small>ABOUT</small>
            <p>{loadingFriendProfile ? "Loading…" : friendProfile.bio?.trim() || "Hey there! I am using ConnectX."}</p>
            {friendProfile.show_last_seen === false && <span className="friend-profile-note">Last seen is hidden</span>}
          </div>
          <div className="friend-profile-section friend-profile-media">
            <small>MEDIA, LINKS AND DOCS</small>
            <strong>{messages.filter((m) => m.message_type === "image" || m.message_type === "video").length}</strong>
            <span>Shared photos and videos in this chat</span>
          </div>
          <div className="friend-profile-section friend-profile-groups">
            <small>GROUPS IN COMMON</small>
            {loadingFriendProfile ? <p>Loading shared groups…</p> : commonGroups.length ? (
              <div className="common-groups-list">
                {commonGroups.map((group) => <div className="common-group-row" key={group.id}>
                  <span className="common-group-avatar">♧</span>
                  <span><strong>{group.name}</strong><small>{group.description || "Group conversation"}</small></span>
                </div>)}
              </div>
            ) : <p>No groups in common yet.</p>}
          </div>
          <div className="friend-profile-footer">Username · {friendProfile.username ? "@" + friendProfile.username : "Not set"}</div>
        </section>
      </div>}

      {photoViewer && <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={`${photoViewer.name} profile photo`} onClick={() => setPhotoViewer(null)}>
        <div className="photo-viewer-card" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="photo-viewer-close" onClick={() => setPhotoViewer(null)} aria-label="Close photo">×</button>
          <img src={photoViewer.url} alt={`${photoViewer.name} profile photo enlarged`} />
          <strong>{photoViewer.name}</strong>
        </div>
      </div>}

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
        .cx-list { touch-action:pan-y;  width:360px;min-width:300px;min-height:0;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#121a2b;border-right:1px solid #232d42; }.list-head { flex-shrink:0; }.list-label { flex-shrink:0; }.profile-editor { padding-bottom:calc(32px + env(safe-area-inset-bottom)); }
        .list-head { padding:24px 20px 18px;display:flex;align-items:center;justify-content:space-between; }
        .cx-brand { font-size:22px;font-weight:850;letter-spacing:-.8px; }.cx-brand span { color:#a99aff; }
        .list-head p { margin:5px 0 0;color:#8490a9;font-size:12px; }
        .icon-btn { width:36px;height:36px;border:1px solid #39445d;border-radius:11px;background:#1b2540;color:#c9bfff;font-size:22px;cursor:pointer; }
        .search-box { margin:0 17px 20px;padding:11px 12px;display:flex;gap:9px;border-radius:10px;background:#0c1424;color:#8b96ad; }
        .search-box input,.composer input,.composer textarea { width:100%;min-width:0;border:0;outline:0;background:transparent;color:#fff;font:inherit;font-size:12px; }\n        .composer .composer-textarea { flex:1;min-height:40px;max-height:35vh;resize:none;overflow-y:auto;padding:10px 12px;border-radius:20px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere; }
        .list-label { display:flex;justify-content:space-between;padding:0 21px 10px;color:#7e89a2;font-size:10px;font-weight:800;letter-spacing:1.5px; }
        .cx-chats { flex:1;overflow:auto;padding:0 9px 16px; }
        .chat-row,.person-row { width:100%;display:flex;align-items:center;gap:11px;padding:12px;border:0;border-radius:13px;background:transparent;color:inherit;text-align:left;margin-bottom:4px; }
        .chat-row { cursor:pointer; }.chat-row.active { background:#202a40; }
        .chat-row-wrap { border-bottom:1px solid var(--border,rgba(128,128,128,.16));padding:3px 0 7px; }.chat-row-wrap .chat-row { width:100%;margin-bottom:2px; }.chat-row-tools { display:flex;gap:8px;padding-left:54px;flex-wrap:wrap; }.text-btn { border:0;background:transparent;color:var(--muted,#8b91a5);font-size:11px;padding:4px 2px;cursor:pointer; }.text-btn:hover { color:var(--foreground,#fff); }
        .avatar { width:43px;height:43px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:#6257a8;font-size:12px;font-weight:800;color:white; }
        .chat-info { flex:1;min-width:0;display:flex;flex-direction:column;gap:5px; }.chat-info strong,.person strong { font-size:13px; }.chat-info small { color:#8b96ad;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .empty { color:#8994ad;text-align:center;font-size:12px;padding:20px;line-height:1.5; }
        .profile-row { display:flex;align-items:center;gap:10px;padding:16px;border-top:1px solid #263149; }.profile-avatar { width:35px;height:35px;font-size:11px; }.profile-row strong,.profile-row small { display:block;font-size:11px; }.profile-row small { color:#8290a9;margin-top:4px; }.online-dot { margin-left:auto;color:#55c69a;font-size:11px; }
        .cx-conversation { flex:1;min-width:0;display:flex;flex-direction:column;background:#0d1423; }.conversation-head { height:78px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 24px;border-bottom:1px solid #232d42;background:#121a2b; }
        .person { flex:1; }.person small { display:block;color:#58c69c;font-size:10px;margin-top:5px; }.profile-open-avatar,.profile-open-name { border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;padding:0; }.profile-open-avatar { border-radius:50%; }.profile-open-avatar:focus-visible,.profile-open-name:focus-visible { outline:2px solid #9b8cff;outline-offset:4px;border-radius:8px; }.profile-open-name { min-width:0; }.profile-modal-backdrop { position:fixed;z-index:30;inset:0;display:grid;place-items:center;padding:18px;background:#050914bb;backdrop-filter:blur(7px); }.group-profile-card { width:min(100%,500px);max-height:min(88dvh,820px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin; }
        .group-profile-card .group-profile-section { box-shadow:0 5px 18px #080b141c; }
        .group-profile-form input:focus,.group-profile-form textarea:focus { outline:2px solid #7868eb55;border-color:#8878f3; }
        .group-profile-form .action-btn { justify-self:start;min-height:42px;padding:10px 18px;border:0;border-radius:11px;background:#7868eb;color:#fff;font-size:13px;font-weight:650; }
        .group-profile-card .friend-profile-topbar { min-height:58px; }
        @media (max-width:600px) {
          .profile-modal-backdrop.group-profile-backdrop { align-items:end;padding:0;background:#050914c9; }
          .group-profile-card { width:100%;max-width:none;max-height:92dvh;border-radius:22px 22px 0 0;border:1px solid #34384c;border-bottom:0;padding-bottom:calc(14px + env(safe-area-inset-bottom)); }
          .group-profile-hero { padding:22px 18px 18px; }
          .group-profile-avatar { width:78px;height:78px;font-size:34px; }
          .group-profile-card .group-profile-section { margin:10px 12px;padding:14px; }
          .group-profile-member { gap:9px; }
          .group-member-actions { width:100%;padding-left:52px; }
          .group-profile-form .action-btn { width:100%; }
        }
        .group-profile-card { width:min(100%,500px);max-height:88dvh;overflow-y:auto;border:1px solid #303449;border-radius:22px;background:#171a27;box-shadow:0 22px 70px #0009; }.group-profile-card .friend-profile-topbar { position:sticky;top:0;background:#171a27;border-bottom:1px solid #2d3042; }.group-info-menu-button { margin-left:auto;width:34px;height:34px;border:0;background:transparent;color:#e7e8f0;font-size:25px; }.group-profile-hero { padding:26px 20px 22px;text-align:center;border-bottom:1px solid #2d3042; }.group-profile-avatar { width:94px;height:94px;margin:0 auto 14px;display:grid;place-items:center;border-radius:50%;background:#6957c7;color:white;font-size:42px; }.group-profile-hero h2 { margin:0;font-size:22px;font-weight:700; }.group-profile-hero p { margin:7px 0 3px;color:#c4c8d5;font-size:13px; }.group-profile-hero small { color:#8f98ad;font-size:11px; }.group-profile-card .group-profile-section { margin:12px 15px;padding:16px;border:1px solid #303447;border-radius:15px;background:#202231; }.group-profile-card .group-profile-section>small { display:block;margin-bottom:11px;color:#aa9cff;font-size:10px;font-weight:800;letter-spacing:1px; }.group-profile-form { display:grid;gap:9px; }.group-profile-form input,.group-profile-form textarea { width:100%;min-width:0;padding:11px 12px;border:1px solid #3a3e52;border-radius:10px;background:#171a27;color:#f5f6fc;font:inherit;font-size:13px; }.group-participant-heading { display:flex;justify-content:space-between;align-items:center; }.group-participant-heading span { color:#a99aff;font-size:11px; }.group-profile-member { display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding:11px 0;border-bottom:1px solid #343649; }.group-member-avatar { width:43px;height:43px;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#6257a8;color:white;font-weight:700; }.group-member-avatar img { width:100%;height:100%;object-fit:cover; }.group-member-name { display:grid;gap:4px;flex:1;min-width:100px; }.group-member-name small { color:#929bb0;font-size:11px; }.group-member-actions { display:flex;gap:8px; }.group-add-members { display:grid;gap:8px;padding-top:13px; }.group-add-members>strong { color:#a99aff;font-size:12px; }
        .friend-profile-card { width:min(100%,440px);max-height:min(90dvh,820px);overflow-y:auto;border:1px solid #39445e;border-radius:18px;background:#151f33;color:#f5f6fc;box-shadow:0 24px 80px #0009;text-align:left; }.friend-profile-topbar { position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:16px;padding:13px 16px;background:#151f33;border-bottom:1px solid #303b53; }.friend-profile-topbar button { width:30px;height:30px;border:0;background:transparent;color:inherit;font-size:28px;line-height:1; }.friend-profile-topbar strong { flex:1;font-size:15px;font-weight:600; }.friend-profile-identity { padding:28px 20px 20px;text-align:center; }.friend-profile-avatar { width:112px;height:112px;margin:0 auto 15px;padding:0;border:0;overflow:hidden;display:grid;place-items:center;border-radius:50%;background:#6257a8;color:#fff;font-size:30px;font-weight:800;cursor:pointer; }.friend-profile-avatar img { width:100%;height:100%;object-fit:cover; }.friend-profile-card h2 { margin:0;font-size:22px;font-weight:650; }.friend-profile-username { margin:6px 0;color:#a99aff;font-size:13px; }.friend-profile-identity>small { color:#8996af;font-size:11px; }.friend-profile-actions { display:flex;justify-content:center;gap:12px;margin:22px auto 0; }.friend-profile-actions button { display:flex;min-width:88px;flex-direction:column;align-items:center;gap:7px;padding:10px 14px;border:1px solid #39445e;border-radius:12px;background:#202a40;color:#b9a7ff;font-size:11px; }.friend-profile-actions button span { font-size:20px; }.friend-profile-section { margin:0 14px 10px;padding:15px 16px;border-radius:12px;background:#202a40; }.friend-profile-section>small { display:block;margin-bottom:10px;color:#a99aff;font-size:10px;font-weight:700;letter-spacing:1px; }.friend-profile-section p { margin:0;color:#e1e5ef;font-size:13px;line-height:1.5;overflow-wrap:anywhere; }.friend-profile-note { display:block;margin-top:10px;color:#8996af;font-size:11px; }        .friend-profile-groups .common-groups-list { display:grid;gap:10px; }
        .common-group-row { display:flex;align-items:center;gap:11px;min-width:0; }
        .common-group-avatar { width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:12px;background:#39345b;color:#c5b6ff;font-size:18px; }
        .common-group-row>span:last-child { min-width:0;display:grid;gap:4px; }
        .common-group-row strong { color:#f5f6fc;font-size:13px;overflow-wrap:anywhere; }
        .common-group-row small { color:#8996af;font-size:11px;overflow-wrap:anywhere; }
.friend-profile-media { display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 12px; }.friend-profile-media>small { grid-column:1/-1; }.friend-profile-media strong { font-size:22px; }.friend-profile-media span { color:#8996af;font-size:11px; }.friend-profile-footer { padding:10px 20px 18px;color:#8996af;font-size:11px; }.cx-shell[data-theme="dark"] .friend-profile-card,.cx-shell[data-theme="dark"] .friend-profile-topbar { background:#171722;border-color:#302e42; }.cx-shell[data-theme="dark"] .friend-profile-section,.cx-shell[data-theme="dark"] .friend-profile-actions button { background:#20202d;border-color:#39364d; }.messages-area { flex:1;overflow:auto;padding:25px clamp(16px,5vw,70px);display:flex;flex-direction:column;gap:14px; }
        .today { align-self:center;padding:6px 12px;border-radius:20px;background:#182237;color:#8994ad;font-size:9px;letter-spacing:1px;margin-bottom:12px; }
        .message-line { display:flex;width:100%;justify-content:flex-start; }.message-line.mine { justify-content:flex-end; }.reply-compose { display:flex;align-items:center;justify-content:space-between;gap:10px;flex:1 0 100%;padding:8px 11px;border-left:3px solid #8068e8;border-radius:8px;background:#f1efff;color:#30245a; }.reply-compose span { display:flex;min-width:0;flex-direction:column;gap:3px; }.reply-compose strong { font-size:11px; }.reply-compose small { overflow:hidden;color:#81799f;font-size:11px;text-overflow:ellipsis;white-space:nowrap; }.reply-compose button { border:0;background:transparent;color:inherit;font-size:22px; }.reply-quote { display:flex;flex-direction:column;gap:3px;margin-bottom:7px;padding:6px 8px;border-left:3px solid #a18af0;border-radius:6px;background:#ffffff25; }.reply-quote strong { font-size:10px;opacity:.85; }.reply-quote span { overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap;max-width:230px; }.message-line { touch-action:pan-y; }.bubble { max-width:min(75%,440px);padding:11px 14px 8px;border-radius:16px 16px 16px 5px;background:#202b40; }.mine-bubble { background:#6858d8;border-radius:16px 16px 5px 16px; }.bubble p { margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere; }.bubble small { display:block;text-align:right;color:#d2ccef;font-size:9px;margin-top:5px; }
        .group-composer { position:relative;overflow:visible; }.group-more-btn { flex:0 0 42px;width:42px;height:42px;border:1px solid #56617b;border-radius:13px;background:#1b2540;color:#c9bfff;font-size:24px;line-height:1;cursor:pointer; }.group-tools-panel { position:absolute;z-index:40;left:12px;right:12px;bottom:calc(100% + 10px);width:auto;max-width:420px;margin-left:auto;display:grid;gap:12px;padding:14px;border:1px solid #46516b;border-radius:18px;background:#1b2438;box-shadow:0 14px 42px #0009; }.group-tools-panel-head { display:flex;align-items:center;justify-content:space-between;color:#f5f5fb;font-size:14px; }.group-tools-panel-head button { width:30px;height:30px;border:0;border-radius:50%;background:#303951;color:#fff;font-size:20px; }.group-tools-tabs { display:grid;grid-template-columns:1fr 1fr;gap:10px; }.group-tools-tabs button { min-height:48px;border:1px solid #46516b;border-radius:12px;padding:10px;background:#222e47;color:#eee;font-size:13px; }.group-tools-tabs button:disabled { opacity:.4; }.group-tool-editor { display:grid;gap:10px; }.group-tool-editor input,.group-tool-editor textarea { width:100%;min-height:44px;border:1px solid #46516b;border-radius:11px;background:#0c1424;color:#fff;padding:12px;font:inherit;font-size:14px; }.group-tool-editor textarea { resize:vertical; }.group-tool-editor .action-btn { justify-self:stretch;min-height:44px;padding:10px 14px;border:0;border-radius:11px;background:#7868eb;color:white;font-weight:700; }
        .composer { display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:15px 20px;border-top:1px solid #232d42;background:#121a2b;position:relative; }.composer > input:not([type="file"]) { flex:1 1 120px;min-width:0;padding:14px;border:1px solid #37425c;border-radius:12px;background:#0c1424;font-size:13px; }.composer .attach-btn { position:relative;overflow:hidden;display:grid;place-items:center; }.composer .attachment-input { position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer; }.attach-btn { flex:0 0 40px;height:40px;border:1px solid #56617b;border-radius:12px;background:transparent;color:#b8aaff;font-size:28px;line-height:1;cursor:pointer; }.attachment-preview { display:flex;align-items:center;gap:8px;flex-basis:100%;min-width:0;padding:7px 10px;border:1px solid #e7e1ff;border-radius:12px;background:#f4f2ff;color:#514774;font-size:11px; }.attachment-preview img,.attachment-preview video { width:42px;height:42px;flex:0 0 42px;border-radius:8px;object-fit:cover;background:#ddd; }.attachment-preview span { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.attachment-preview button { border:0;background:transparent;color:#7054c8;font-size:22px;cursor:pointer; }.chat-media { display:block;max-width:min(260px,65vw);max-height:320px;border-radius:12px;object-fit:contain; }.expired-media { color:inherit;opacity:.75;font-size:12px; }.send,.mini-btn,.action-btn { border:0;border-radius:10px;background:#7868eb;color:white;font-weight:700;cursor:pointer; }.composer .send { position:relative;z-index:5;display:grid;place-items:center;width:46px;height:46px;min-width:46px;flex:0 0 46px;margin:0;padding:0;border:0;border-radius:12px;background:#7868eb;color:#fff;font-size:19px;font-weight:800;cursor:pointer;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent; }.send:disabled,.mini-btn:disabled { opacity:.4;cursor:not-allowed; }
        .chat-more-wrap{position:relative}.chat-more-menu{position:absolute;right:0;top:44px;z-index:25;width:220px;padding:6px;border:1px solid #39445e;border-radius:13px;background:#171f32;box-shadow:0 14px 38px #0008}.chat-more-menu button{display:block;width:100%;padding:11px 10px;border:0;border-radius:8px;background:transparent;color:#edf0fa;text-align:left;font-size:12px}.chat-more-menu button:hover{background:#2b3450}.chat-more-menu .danger-option{color:#ff9aa8}.chat-theme-panel{padding:12px 14px;background:#191b2b;border-bottom:1px solid #35334a;color:#f4f2ff}.chat-theme-heading{display:flex;justify-content:space-between;align-items:center;font-size:13px}.chat-theme-heading button,.chat-search-bar button{border:0;background:transparent;color:inherit;font-size:20px}.chat-theme-carousel{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:12px 2px 8px;touch-action:pan-x}.chat-theme-choice{flex:0 0 86px;display:flex;flex-direction:column;gap:6px;align-items:center;border:2px solid transparent;border-radius:10px;background:transparent;color:#e8e7f2;padding:5px;scroll-snap-align:center}.chat-theme-choice.chosen{border-color:#a99aff}.theme-preview{width:72px;height:54px;padding:6px;display:flex;flex-direction:column;gap:4px;border-radius:8px}.theme-preview i{width:35px;height:9px;border-radius:8px}.theme-preview i:nth-child(2){align-self:flex-end}.chat-theme-choice small{font-size:10px}.chat-search-bar{display:flex;align-items:center;gap:9px;padding:9px 13px;background:#20202d;color:#eeeaf8}.chat-search-bar input{flex:1;min-width:0;padding:9px;border:1px solid #414157;border-radius:8px;background:#11111b;color:inherit}.chat-search-bar small{white-space:nowrap;color:#aaa4bd;font-size:10px}.call-actions { display:flex;gap:8px;margin-left:auto; }.call-icon { width:36px;height:36px;border:1px solid #3b4560;border-radius:11px;background:#202a40;color:#d9d2ff;font-size:17px;cursor:pointer; }.call-icon:disabled { opacity:.4;cursor:not-allowed; }
        .call-overlay { position:fixed;z-index:20;inset:0;display:grid;place-items:center;padding:18px;background:#050914dd;backdrop-filter:blur(8px); }.incoming-card,.active-call-card { width:min(100%,520px);border:1px solid #3a4562;border-radius:22px;background:#151f33;color:#f5f6fc;box-shadow:0 24px 80px #0009;overflow:hidden; }.incoming-card { padding:34px 24px;text-align:center; }.call-avatar { width:82px;height:82px;margin:10px auto 20px;display:grid;place-items:center;border-radius:50%;background:#6257b5;color:white;font-size:36px; }.incoming-card h2 { margin:0;font-size:20px; }.incoming-card p { color:#9ca8c0;font-size:13px; }.incoming-actions,.call-controls { display:flex;justify-content:center;gap:12px;margin-top:26px; }.incoming-actions button,.call-controls button { padding:12px 18px;border:0;border-radius:12px;background:#303b53;color:#fff;font-weight:700; }.accept-call { background:#23875e!important; }.decline-call,.hangup { background:#b83c55!important; }.active-call-card { padding:18px; }.call-topline { display:flex;justify-content:space-between;gap:12px;align-items:center;padding:4px 4px 14px;font-size:13px; }.call-topline span { color:#9da9c0;font-size:11px; }.video-stage { position:relative;height:min(58vh,420px);min-height:230px;border-radius:15px;overflow:hidden;background:#070b14; }.remote-video { width:100%;height:100%;object-fit:cover; }.local-video { position:absolute;right:12px;bottom:12px;width:26%;max-height:35%;aspect-ratio:3/4;object-fit:cover;border:2px solid #fff;border-radius:12px;background:#202a40; }.video-placeholder { position:absolute;inset:0;display:grid;place-items:center;color:#aab5ca;font-size:12px;pointer-events:none; }.audio-stage { min-height:260px;display:grid;align-content:center;text-align:center;color:#aab5ca; }.audio-stage .call-avatar { margin-bottom:4px; }.audio-stage p { font-size:12px; }.call-controls { margin:18px 0 4px;flex-wrap:wrap; }.call-controls .control-on { background:#6557c7; }
        .read-ticks { color:#54b9ff;font-weight:900;letter-spacing:-3px;padding-right:3px; }.reaction-chip { margin:6px 4px 0 0;padding:4px 7px;border:1px solid #56617b;border-radius:12px;background:#27344d;color:white;font-size:11px; }.reaction-picker { display:flex;gap:4px;margin-top:7px;padding:5px;background:#101a2c;border:1px solid #45516d;border-radius:20px;width:max-content; }.reaction-picker button,.react-trigger { border:0;background:transparent;color:white;font-size:17px;cursor:pointer; }.react-trigger { display:block;margin-left:auto;font-size:13px;color:#b8c3d9; }.typing-indicator { align-self:flex-start;color:#aeb9d0;font-size:11px;display:flex;align-items:center;gap:4px; }.typing-indicator span { width:5px;height:5px;border-radius:50%;background:#a99aff;animation:typingPulse .8s infinite alternate; }.typing-indicator span:nth-child(2) { animation-delay:.2s; }.typing-indicator span:nth-child(3) { animation-delay:.4s; } @keyframes typingPulse { to { opacity:.25;transform:translateY(-3px); } }.bulk-actions { display:flex;align-items:center;gap:6px;padding:8px;position:sticky;top:0;background:#121a2b;z-index:2; }.bulk-actions strong { flex:1;font-size:11px; }.bulk-actions button { border:1px solid #46516b;border-radius:8px;padding:6px;background:#202a40;color:#fff;font-size:10px; }.chat-row.chat-selected { outline:2px solid #8e80ff;background:#28264a; }
        .back-btn { display:none;border:0;background:transparent;color:#c9bfff;font-size:28px; }.empty-state { margin:auto;color:#8490a9;text-align:center;padding:20px; }
        .groups-heading { display:flex;align-items:center;justify-content:space-between;padding:16px 12px 8px;color:#817b91;font-size:11px;font-weight:700;letter-spacing:1px; }.group-row { display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;margin-bottom:7px;border:1px solid #eeeaff;border-radius:13px;background:#faf9ff;color:#30245a;text-align:left; }.group-avatar { display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#eeeaff;color:#7659dc;font-size:20px; }.group-empty { padding:4px 12px 12px;color:#918aa4;font-size:11px; }
        .section-caption { padding:14px 12px 7px;color:#77839c;font-size:9px;font-weight:800;letter-spacing:1.4px; }.request-caption { border-top:1px solid #263149;margin-top:12px; }
        .mini-btn { padding:8px 10px;font-size:10px;white-space:nowrap; }.muted-btn,.action-btn.secondary { background:#303b53;color:#d1d8e8; }
        .request-row { display:flex;align-items:center;gap:7px;padding:10px 12px;color:#dce2f2;font-size:11px; }.request-row span { flex:1; }.settings-panel { padding:24px;text-align:center; }.large-avatar { width:76px;height:76px;margin:8px auto 14px;font-size:24px;border-radius:50%;display:grid;place-items:center;background:#29334b;color:#fff; }.profile-photo-wrap { display:flex;justify-content:center;margin:8px 0 18px; }.profile-photo { width:88px;height:88px;border-radius:50%;object-fit:cover;border:2px solid #56617b; }.profile-editor { text-align:left;display:flex;flex-direction:column;gap:10px; }.profile-field { display:flex;flex-direction:column;gap:6px;text-align:left;color:#cbd5e8;font-size:12px;font-weight:600; }.profile-field input,.profile-field textarea { width:100%;box-sizing:border-box;border:1px solid #35415a;border-radius:9px;background:#111a2b;color:#f3f6ff;padding:11px;font:inherit;font-weight:400; }.profile-field input[type=file] { font-size:11px; }.profile-field textarea { resize:vertical; }.profile-hint { color:#8290aa;font-size:10px;text-align:left;margin-top:-7px; }.privacy-heading { color:#9ca9c1;font-size:10px;letter-spacing:1px;text-align:left;margin-top:12px; }.privacy-option { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid #303b53;border-radius:10px;text-align:left; }.privacy-option span { display:flex;flex-direction:column;gap:4px; }.privacy-option strong { color:#e9eefb;font-size:12px; }.privacy-option small { color:#8b96ad;font-size:10px; }.privacy-option input { accent-color:#8e80ff;width:18px;height:18px; }.action-btn { padding:12px 18px;margin-top:12px; }.toast { position:fixed;z-index:5;bottom:22px;left:50%;transform:translateX(-50%);max-width:min(92vw,560px);display:flex;gap:14px;align-items:center;padding:12px 15px;border:1px solid #3b4a65;border-radius:12px;background:#1b2940;color:#dce6ff;font-size:12px;box-shadow:0 10px 40px #0008; }.toast button { border:0;background:transparent;color:white;font-size:18px; }.error-toast { border-color:#8a4250;background:#3a202c;color:#ffd2d9; }

        .message-line.message-selected { border-radius:14px;outline:2px solid #7659dc;outline-offset:3px;background:#7659dc18; }
        .message-selection-toolbar { position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;background:#f3efff;border-bottom:1px solid #ded5ff; }
        .message-selection-toolbar strong { flex:1;min-width:120px;color:#38266d;font-size:12px; }
        .message-selection-toolbar button { padding:8px 12px;border:0;border-radius:9px;background:#7659dc;color:#fff;font-size:12px;font-weight:650; }
        .message-selection-toolbar button:disabled { opacity:.45; }
        .cx-shell[data-theme="dark"] { background:#101018;color:#eeeaf8; }
        .cx-shell[data-theme="dark"] .cx-list,
        .cx-shell[data-theme="dark"] .cx-conversation,
        .cx-shell[data-theme="dark"] .cx-conversation.show-mobile { background:#101018;color:#eeeaf8; }
        .cx-shell[data-theme="dark"] .list-head,
        .cx-shell[data-theme="dark"] .conversation-head { background:#171722;color:#f2efff;border-color:#29283a; }
        .cx-shell[data-theme="dark"] .cx-brand,
        .cx-shell[data-theme="dark"] .chat-info strong,
        .cx-shell[data-theme="dark"] .person,
        .cx-shell[data-theme="dark"] .status-person,
        .cx-shell[data-theme="dark"] .status-person-copy strong,
        .cx-shell[data-theme="dark"] .status-empty strong { color:#f0edff; }
        .cx-shell[data-theme="dark"] .list-head p,
        .cx-shell[data-theme="dark"] .chat-info small,
        .cx-shell[data-theme="dark"] .list-label,
        .cx-shell[data-theme="dark"] .person small,
        .cx-shell[data-theme="dark"] .status-person-copy small { color:#aaa4bd; }
        .cx-shell[data-theme="dark"] .search-box,
        .cx-shell[data-theme="dark"] .search-row .search-box,
        .cx-shell[data-theme="dark"] .chat-row,
        .cx-shell[data-theme="dark"] .today,
        .cx-shell[data-theme="dark"] .composer input,.cx-shell[data-theme="dark"] .composer textarea { background:#20202d;color:#eeeaf8;border-color:#343247; }
        .cx-shell[data-theme="dark"] .chat-row.active,
        .cx-shell[data-theme="dark"] .chat-row.chat-selected { background:#30294a; }
        .cx-shell[data-theme="dark"] .messages-area { background:#11111b; }
        .cx-shell[data-theme="dark"] .bubble { background:#29283a;color:#f0edff; }
        .cx-shell[data-theme="dark"] .mine-bubble { background:#6548bb;color:#fff; }
        .cx-shell[data-theme="dark"] .composer,
        .cx-shell[data-theme="dark"] .mobile-nav { background:#171722;border-color:#302e42; }
        .cx-shell[data-theme="dark"] .nav-item { color:#aaa4bd; }
        .cx-shell[data-theme="dark"] .nav-item.active,
        .cx-shell[data-theme="dark"] .back-btn { color:#b8a5ff; }
        .cx-shell[data-theme="dark"] .nav-indicator { background:#30294a; }
        .cx-shell[data-theme="dark"] .settings-panel { background:#101018; }
        .cx-shell[data-theme="dark"] .profile-field,
        .cx-shell[data-theme="dark"] .privacy-option strong { color:#eeeaf8; }
        .cx-shell[data-theme="dark"] .profile-field input,
        .cx-shell[data-theme="dark"] .profile-field textarea,
        .cx-shell[data-theme="dark"] .status-compose textarea { background:#20202d;color:#eeeaf8;border-color:#39364d; }
        .cx-shell[data-theme="dark"] .privacy-option,
        .cx-shell[data-theme="dark"] .status-person { border-color:#302e42; }
        .cx-shell[data-theme="dark"] .privacy-option small,
        .cx-shell[data-theme="dark"] .profile-hint,
        .cx-shell[data-theme="dark"] .empty-state { color:#aaa4bd; }
        .cx-shell[data-theme="dark"] .status-topbar h2,
        .cx-shell[data-theme="dark"] .status-compose-head { color:#f0edff; }
        .cx-shell[data-theme="dark"] .status-topbar p,
        .cx-shell[data-theme="dark"] .status-empty { color:#aaa4bd; }
        .cx-shell[data-theme="dark"] .status-compose { background:#1b1a28;border-color:#39364d;color:#eeeaf8; }
        .cx-shell[data-theme="dark"] .status-viewer-content { background:#09070d;color:white; }
        .cx-shell[data-theme="dark"] .voice-preview { background:#29283a; }
        .cx-shell[data-theme="dark"] .group-row,
        .cx-shell[data-theme="dark"] .person-row,
        .cx-shell[data-theme="dark"] .request-row { color:#eeeaf8;border-color:#302e42; }
        .cx-shell[data-theme="dark"] .group-row { background:#20202d; }
        @media(max-width:700px) { .profile-modal-backdrop { display:block;padding:0;background:#101018;backdrop-filter:none; }.friend-profile-card { width:100%;height:100dvh;max-height:100dvh;border:0;border-radius:0; }.friend-profile-identity { padding-top:38px; }.cx-rail { width:54px; }.cx-list { width:calc(100% - 54px);min-width:0; }.cx-conversation { display:none; }.cx-conversation.show-mobile { display:flex;position:absolute;inset:0 0 0 54px;z-index:2; }.cx-list.hide-mobile { display:none; }.back-btn { display:block; }.conversation-head { padding:0 12px;gap:9px; }.composer { padding:12px; }.messages-area { padding:20px 14px; } }
        .header-profile img { width:100%;height:100%;object-fit:cover;border-radius:50%; }
        .chat-row-photo { object-fit:cover;cursor:zoom-in; }.chat-header-avatar { object-fit:cover; }
        .photo-viewer { position:fixed;z-index:60;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#080711d9; }
        .photo-viewer-card { position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;max-width:min(90vw,440px);max-height:90vh;color:#fff; }
        .photo-viewer-card img { display:block;width:min(78vw,380px);height:min(78vw,380px);max-height:70vh;object-fit:contain;border-radius:18px;background:#171522; }
        .photo-viewer-card strong { font-size:15px; }.photo-viewer-close { position:absolute;top:-14px;right:-14px;z-index:1;width:38px;height:38px;border:1px solid #ffffff55;border-radius:50%;background:#242131;color:white;font-size:26px;line-height:1;cursor:pointer; }
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
          .composer { padding:12px;background:#fff;border-top:1px solid #eeeaff; }.composer input,.composer textarea { background:#f4f2ff;color:#241653;border:1px solid #e7e1ff; }
          .settings-panel { padding:16px 28px 30px; }.profile-field { color:#514774; }.profile-field input,.profile-field textarea { background:#fff;color:#241653;border-color:#ded9ef; }.privacy-option { border-color:#e8e3f5; }.privacy-option strong { color:#241653; }.privacy-option small { color:#777092; }
          .empty-state { color:#777092; }
          .status-compose { margin:0 4px 12px; }.status-card { margin:10px 4px; }
          .composer { position:relative;display:flex;flex-wrap:nowrap;align-items:flex-end;gap:8px;padding:10px 12px; }.composer .attach-btn,.composer .mic-btn { flex:0 0 40px;width:40px;height:40px; }.composer .composer-textarea { flex:1 1 0%;width:0;min-width:0;height:44px;min-height:44px;max-height:96px;padding:10px 11px;border-radius:14px;font-size:14px; }.composer .send { flex:0 0 44px;width:44px;height:44px;min-width:44px;border-radius:12px;font-size:20px; }.composer .attachment-preview { position:absolute;left:12px;right:12px;bottom:calc(100% + 6px);z-index:3;background:#242332;border-radius:12px;padding:8px; }.voice-preview { bottom:calc(100% + 6px); }.recording-label { font-size:10px; }
          .mic-btn { flex:0 0 40px;height:40px;border:0;border-radius:50%;background:#eeeaff;color:#654bc0;font-size:18px; }
          .voice-player { width:min(230px,65vw);height:36px; }
          .voice-preview { display:flex;align-items:center;gap:6px;position:absolute;bottom:72px;left:12px;right:12px;padding:8px;border-radius:12px;background:#f3f0ff; }
          .recording-label { color:#c64d65;font-size:11px;white-space:nowrap; }
          .status-viewer { position:fixed;z-index:40;inset:0;display:flex;align-items:center;justify-content:center;padding:0;background:#09070d; }.status-viewer-content { touch-action:pan-y;position:relative;display:flex;width:100%;height:100%;max-width:560px;flex-direction:column;padding:env(safe-area-inset-top) 14px env(safe-area-inset-bottom);background:#09070d;color:white; }.status-progress { display:flex;gap:4px;padding-top:10px; }.status-progress span { flex:1;height:3px;overflow:hidden;border-radius:5px;background:#ffffff55; }.status-progress span.done { background:white; }.status-viewer-head { display:flex;align-items:center;gap:9px;padding:14px 2px;color:white; }.status-viewer-head strong { font-size:14px; }.status-viewer-head small { flex:1;color:#ffffffaa;font-size:11px; }.status-viewer-head button { border:0;background:transparent;color:white;font-size:30px; }.status-viewer-head .status-user-swipe-prev,.status-viewer-head .status-user-swipe-next { flex:0 0 28px;width:28px;height:34px;font-size:28px;opacity:.9; }.status-viewer-head .status-user-swipe-prev:disabled,.status-viewer-head .status-user-swipe-next:disabled { opacity:.2; }.status-viewer-media { display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:hidden; }.status-viewer-media img,.status-viewer-media video { max-width:100%;max-height:100%;object-fit:contain; }.status-viewer-media p { max-width:90%;color:white;font-size:25px;line-height:1.45;text-align:center;overflow-wrap:anywhere; }.status-viewer-caption { padding:12px 8px;color:white;text-align:center;font-size:14px; }.status-interaction-bar { position:relative;z-index:3;display:flex;flex-direction:column;gap:10px;padding:10px 0 calc(12px + env(safe-area-inset-bottom));background:linear-gradient(transparent,#09070d 22%); }.status-emoji-bar { display:flex;align-items:center;justify-content:space-between;gap:5px; }.status-emoji-bar button { flex:1;min-width:0;height:42px;border:1px solid #ffffff25;border-radius:22px;background:#ffffff18;color:white;font-size:22px; }.status-emoji-bar button.selected { background:#7659dc55;border-color:#b9a3ff;transform:scale(1.08); }.status-reply-form { display:flex;align-items:center;gap:9px; }.status-reply-form input { flex:1;min-width:0;height:46px;padding:0 16px;border:1px solid #ffffff66;border-radius:24px;background:#17171c;color:white;font-size:14px;outline:none; }.status-reply-form input::placeholder { color:#ffffffa8; }.status-reply-form button { flex:0 0 46px;width:46px;height:46px;border:0;border-radius:50%;background:#7868eb;color:white;font-size:20px; }.status-reply-form button:disabled { opacity:.45; }.status-viewer-nav { position:absolute;inset:52px 0 52px;display:flex;align-items:stretch;justify-content:space-between;pointer-events:none; }.status-viewer-nav button { width:25%;border:0;background:transparent;color:transparent;pointer-events:auto; }.status-viewer-nav button:disabled { pointer-events:none; }          .status-panel { overflow-y:auto;padding:0 0 100px; }.status-topbar { display:flex;align-items:center;justify-content:space-between;padding:22px 20px 16px; }.status-topbar h2 { margin:0;color:#211052;font-size:23px;font-weight:700; }.status-topbar p { margin:4px 0 0;color:#8b849f;font-size:12px; }.status-camera { width:40px;height:40px;border:0;border-radius:50%;background:#eeeaff;color:#7155d4;font-size:27px;line-height:1; }.status-list { padding:0 16px; }.status-person { display:flex;align-items:center;gap:13px;width:100%;min-height:76px;padding:10px 2px;border:0;border-bottom:1px solid #f0edf6;background:transparent;text-align:left;color:#241653; }.status-avatar-wrap { position:relative;display:grid;place-items:center;flex:0 0 54px;width:54px;height:54px;border-radius:50%; }.status-avatar-wrap.unread { padding:3px;border:2px solid #20b96b; }.status-avatar-wrap.own { padding:3px;border:2px solid #ded9e9; }.status-avatar { display:grid;place-items:center;width:100%;height:100%;overflow:hidden;border-radius:50%;background:#eeeaff;color:#7054c8;font-size:17px;font-weight:600; }.status-avatar img { width:100%;height:100%;object-fit:cover; }.status-avatar-wrap i { position:absolute;right:-2px;bottom:-1px;display:grid;place-items:center;width:21px;height:21px;border:2px solid white;border-radius:50%;background:#7659dc;color:white;font-size:16px;font-style:normal; }.status-person-copy { display:flex;flex:1;min-width:0;flex-direction:column;gap:5px; }.status-person-copy strong { overflow:hidden;color:#29213e;font-size:14px;font-weight:600;text-overflow:ellipsis;white-space:nowrap; }.status-person-copy small { color:#8d879c;font-size:12px; }.status-add-label,.status-kind { color:#8c849f;font-size:11px; }.my-status-preview { padding:0 0 12px 69px;color:#9690a5;font-size:11px; }.status-section-title { padding:22px 18px 8px;color:#817b91;font-size:11px;font-weight:700;letter-spacing:.7px; }.status-empty { display:flex;align-items:center;flex-direction:column;padding:58px 28px;text-align:center;color:#8d879c; }.status-empty-icon { display:grid;place-items:center;width:58px;height:58px;margin-bottom:14px;border-radius:50%;background:#f0edfa;color:#8067d0;font-size:25px; }.status-empty strong { color:#3b3154;font-size:14px; }.status-empty p { max-width:230px;margin:7px 0;font-size:12px;line-height:1.5; }.status-modal-backdrop { position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:#17112670; }.status-compose { display:flex;width:min(100%,480px);flex-direction:column;gap:12px;padding:18px;border:1px solid #eeeaff;border-radius:22px;background:white;box-shadow:0 12px 40px #17112625; }.status-compose-head { display:flex;align-items:center;justify-content:space-between;color:#241653;font-size:16px; }.status-compose-head button { border:0;background:transparent;color:#7b7193;font-size:26px; }.status-compose textarea { min-height:110px;padding:14px;border:1px solid #e5e0f5;border-radius:14px;resize:vertical;color:#241653;background:#faf9ff; }.status-file { padding:11px;border-radius:12px;background:#f5f2ff;color:#6855b5;font-size:13px; }.status-file input { display:block;margin-top:8px;max-width:100%;font-size:11px; }.status-compose .action-btn { width:100%; }
        }
      `}
        /* Group info: compact WhatsApp-style layout */
        .group-profile-card { width:min(100%,460px); max-height:90dvh; overflow-y:auto; padding:0 0 18px; border:1px solid #303449; border-radius:20px; background:#171a27; box-shadow:0 22px 70px #0009; }
        .group-profile-card .friend-profile-topbar { position:sticky; top:0; z-index:2; min-height:58px; padding:0 16px; background:#171a27; border-bottom:1px solid #2d3042; }
        .group-info-header-spacer { width:34px; }
        .group-profile-hero { padding:24px 18px 20px; text-align:center; border-bottom:1px solid #2d3042; }
        .group-profile-avatar { width:76px; height:76px; margin:0 auto 12px; display:grid; place-items:center; border-radius:50%; background:#6957c7; color:white; font-size:34px; }
        .group-profile-hero h2 { margin:0; font-size:20px; line-height:1.3; font-weight:700; overflow-wrap:anywhere; }
        .group-profile-hero p { margin:6px 0 3px; color:#c4c8d5; font-size:13px; }
        .group-profile-hero small { color:#8f98ad; font-size:11px; }
        .group-profile-card .group-profile-section { margin:10px 12px; padding:14px; border:1px solid #303447; border-radius:14px; background:#202231; box-shadow:none; }
        .group-profile-card .group-profile-section>small,.group-participant-heading>small { display:block; margin-bottom:9px; color:#aa9cff; font-size:10px; font-weight:800; letter-spacing:1px; }
        .group-profile-card .group-profile-section p { margin:0; color:#e3e5ef; font-size:13px; line-height:1.5; overflow-wrap:anywhere; }
        .group-profile-form { display:grid; grid-template-columns:minmax(0,1fr); gap:9px; width:100%; }
        .group-profile-form input,.group-profile-form textarea { display:block; width:100%; min-width:0; min-height:42px; margin:0; padding:11px 12px; border:1px solid #3a4057; border-radius:10px; background:#151a29; color:#f5f6fc; font:inherit; font-size:13px; line-height:1.4; resize:vertical; }
        .group-profile-form textarea { min-height:76px; }
        .group-profile-form .action-btn { justify-self:start; min-height:40px; padding:9px 16px; border:0; border-radius:10px; background:#7868eb; color:white; font-size:13px; font-weight:650; }
        .group-participant-heading { display:flex; justify-content:space-between; align-items:center; gap:10px; }
        .group-participant-heading span { color:#9ba4b9; font-size:11px; }
        .group-profile-member { display:flex; align-items:center; gap:10px; min-width:0; padding:9px 0; border-bottom:1px solid #303447; }
        .group-member-avatar { width:42px; height:42px; flex:0 0 42px; display:grid; place-items:center; overflow:hidden; border-radius:50%; background:#6554b7; color:white; font-weight:700; }
        .group-member-avatar img { width:100%; height:100%; object-fit:cover; }
        .group-member-name { display:grid; gap:3px; min-width:0; flex:1; }
        .group-member-name strong { color:#f2f3fa; font-size:13px; overflow-wrap:anywhere; }
        .group-member-name small { color:#929bb0; font-size:11px; }
        .group-member-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .group-add-members { display:grid; gap:6px; margin-top:14px; }
        .group-add-members>strong { margin-bottom:4px; color:#aa9cff; font-size:11px; }
        .group-more-btn { flex:0 0 40px; width:40px; height:40px; border:0; border-radius:50%; background:#263149; color:#e4dcff; font-size:25px; }
        .group-tools-panel { order:5; flex:1 0 100%; max-height:42dvh; overflow-y:auto; }
        .group-tool-editor textarea,.group-tool-editor input { width:100%; min-height:42px; border:1px solid #46516b; border-radius:10px; background:#0c1424; color:#fff; padding:10px 12px; font:inherit; font-size:13px; }
        @media(max-width:600px) {
          .profile-modal-backdrop.group-profile-backdrop { align-items:flex-end; padding:0; }
          .group-profile-card { width:100%; max-width:none; max-height:88dvh; border-radius:20px 20px 0 0; border-bottom:0; padding-bottom:calc(12px + env(safe-area-inset-bottom)); }
          .group-profile-card .group-profile-section { margin:9px 12px; padding:13px; }
          .group-profile-form .action-btn { width:auto; }
          .group-member-actions { width:100%; padding-left:52px; }
        }

        /* Refined group info sheet: compact, readable and mobile-first */
        .group-profile-card { width:min(100%,460px); max-height:88dvh; overflow-y:auto; padding:0 0 16px; border:1px solid #30364a; border-radius:22px; background:#151927; color:#f4f5fb; box-shadow:0 24px 80px #000a; }
        .group-profile-card .friend-profile-topbar { position:sticky; top:0; z-index:3; min-height:58px; padding:12px 18px; background:#151927; border-bottom:1px solid #2b3144; }
        .group-profile-card .group-profile-hero { display:flex; flex-direction:column; align-items:center; gap:5px; padding:26px 20px 22px; text-align:center; }
        .group-profile-card .group-profile-avatar { width:76px; height:76px; display:grid; place-items:center; margin-bottom:8px; border-radius:50%; background:#6556bb; color:white; font-size:34px; box-shadow:0 8px 24px #6556bb40; }
        .group-profile-card .group-profile-hero h2 { margin:0; font-size:21px; line-height:1.25; overflow-wrap:anywhere; }
        .group-profile-card .group-profile-hero p { margin:2px 0; color:#b4bbcd; font-size:13px; }
        .group-profile-card .group-profile-hero small { color:#858fa7; font-size:11px; }
        .group-profile-card .group-profile-section { margin:0 16px 12px; padding:16px; border:1px solid #2c3348; border-radius:15px; background:#1d2232; box-shadow:none; }
        .group-profile-card .group-profile-section>small,.group-profile-card .group-participant-heading>small { display:block; margin:0 0 12px; color:#a99aff; font-size:11px; font-weight:800; letter-spacing:1px; }
        .group-profile-card .group-profile-section p { margin:0; color:#e1e4ef; font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
        .group-profile-card .group-profile-form { display:grid; grid-template-columns:minmax(0,1fr); gap:10px; margin-top:4px; }
        .group-profile-card .group-profile-form input,.group-profile-card .group-profile-form textarea { display:block; width:100%; min-width:0; min-height:44px; margin:0; padding:12px 13px; border:1px solid #3a425a; border-radius:11px; background:#111727; color:#f5f6fc; font:inherit; font-size:14px; line-height:1.4; }
        .group-profile-card .group-profile-form textarea { min-height:82px; resize:vertical; }
        .group-profile-card .group-profile-form input:focus,.group-profile-card .group-profile-form textarea:focus { outline:2px solid #8878f355; border-color:#8878f3; }
        .group-profile-card .group-profile-form .action-btn { justify-self:stretch; width:100%; min-height:44px; margin:0; padding:11px 16px; border:0; border-radius:11px; background:#7868eb; color:#fff; font-size:13px; font-weight:700; }
        .group-profile-card .group-participant-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
        .group-profile-card .group-participant-heading>small { margin:0; }
        .group-profile-card .group-profile-member { display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding:11px 0; border-bottom:1px solid #30364a; }
        .group-profile-card .group-profile-member:last-of-type { border-bottom:0; }
        .group-profile-card .group-member-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .group-profile-card .group-member-actions .text-btn { padding:6px 9px; border:1px solid #414965; border-radius:8px; color:#c9c0ff; }
        .group-profile-card .group-add-members { display:grid; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid #30364a; }
        .group-profile-card .group-add-members>strong { color:#a99aff; font-size:11px; letter-spacing:.7px; }
        .group-profile-card .group-add-members .text-btn { justify-self:start; padding:7px 0; color:#d5d0f5; font-size:12px; }
        .group-composer { align-items:center; }
        .group-composer .group-more-btn { flex:0 0 42px; width:42px; height:42px; border:1px solid #414b65; border-radius:50%; background:#222b40; color:#e4dcff; font-size:24px; line-height:1; }
        .group-composer .group-tools-panel { order:10; flex:1 0 100%; max-height:42dvh; overflow-y:auto; }
        .group-composer .group-tools-tabs button { min-height:40px; }
        @media(max-width:600px) {
          .profile-modal-backdrop.group-profile-backdrop { align-items:flex-end; padding:0; }
          .group-profile-card { width:100%; max-width:none; max-height:90dvh; border-radius:22px 22px 0 0; border-right:0; border-bottom:0; border-left:0; padding-bottom:calc(16px + env(safe-area-inset-bottom)); }
          .group-profile-card .group-profile-hero { padding:22px 18px 18px; }
          .group-profile-card .group-profile-section { margin:0 12px 10px; padding:14px; }
          .group-profile-card .group-profile-form .action-btn { width:100%; }
          .group-profile-card .group-member-actions { width:100%; padding-left:52px; }
        }

        .group-feed-card { max-width:min(92%,560px); margin:10px auto; padding:13px 15px; border:1px solid #3b4260; border-radius:14px; background:#1b2438; color:#f4f5fb; }
        .group-feed-card>strong { display:block; margin-bottom:8px; color:#c8bcff; font-size:13px; }
        .group-feed-card>p { margin:0 0 8px; white-space:pre-wrap; overflow-wrap:anywhere; font-size:14px; line-height:1.5; }
        .group-feed-card>small { display:block; margin-top:8px; color:#9aa5bc; font-size:10px; }
        .group-feed-card .group-poll-option { display:flex; width:100%; justify-content:space-between; gap:12px; margin-top:6px; padding:10px 12px; border:1px solid #48536e; border-radius:9px; background:#202d46; color:#f4f5fb; text-align:left; }
        .group-feed-card .group-poll-option.voted { border-color:#9888ff; background:#302b55; }

        .group-action-backdrop { position:fixed;inset:0;z-index:999;display:flex;align-items:flex-end;justify-content:center;padding:16px 12px calc(82px + env(safe-area-inset-bottom));background:rgba(4,7,16,.58);backdrop-filter:blur(5px); }
        .group-action-backdrop .group-tools-panel { position:relative;left:auto;right:auto;bottom:auto;width:min(100%,480px);max-height:min(72dvh,620px);overflow-y:auto;margin:0;padding:20px;border:1px solid #414b68;border-radius:24px;background:#1b2234;box-shadow:0 22px 70px #000b;display:grid;gap:18px; }
        .group-action-backdrop .group-tools-panel-head { display:flex;align-items:center;justify-content:space-between;gap:14px; }
        .group-action-backdrop .group-tools-panel-head>div { display:grid;gap:4px; }.group-action-backdrop .group-tools-panel-head strong { font-size:18px;color:#fff; }.group-action-backdrop .group-tools-panel-head small { color:#9ca7bf;font-size:12px; }
        .group-action-backdrop .group-tools-panel-head button { flex:0 0 38px;width:38px;height:38px;border:1px solid #414b68;border-radius:50%;background:#2a3349;color:#fff;font-size:23px; }
        .group-action-backdrop .group-tools-tabs { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
        .group-action-backdrop .group-tools-tabs button { min-width:0;min-height:130px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:8px;padding:16px;border:1px solid #424d69;border-radius:16px;background:#242e45;color:#f4f5fb;text-align:left; }
        .group-action-backdrop .group-tools-tabs button span { font-size:25px; }.group-action-backdrop .group-tools-tabs button strong { font-size:14px; }.group-action-backdrop .group-tools-tabs button small { color:#aab4c9;font-size:11px;line-height:1.4; }
        .group-action-backdrop .group-tool-editor { display:grid;gap:9px; }.group-action-backdrop .group-tool-editor label { color:#dfe3ef;font-size:12px;font-weight:700; }.group-action-backdrop .group-tool-editor label small { color:#9ca7bf;font-weight:400; }
        .group-action-backdrop .group-tool-editor input,.group-action-backdrop .group-tool-editor textarea { width:100%;min-width:0;min-height:48px;padding:13px 14px;border:1px solid #424d69;border-radius:13px;background:#111827;color:#fff;font:inherit;font-size:14px;line-height:1.45; }.group-action-backdrop .group-tool-editor textarea { min-height:108px;resize:vertical; }
        .group-action-backdrop .group-tool-editor .action-btn { width:100%;min-height:48px;margin-top:5px;border:0;border-radius:13px;background:#7868eb;color:#fff;font-size:14px;font-weight:700; }
        .group-feed-card { max-width:min(92%,560px);margin:10px auto;padding:13px 15px;border:1px solid #3b4260;border-radius:14px;background:#1b2438;color:#f4f5fb; }
        @media(max-width:600px){.group-action-backdrop{padding:12px 10px calc(78px + env(safe-area-inset-bottom));}.group-action-backdrop .group-tools-panel{border-radius:22px;padding:18px;}.group-action-backdrop .group-tools-tabs button{min-height:118px;}}

        /* WhatsApp-like group post and poll composer */
        .group-action-backdrop{position:fixed!important;inset:0!important;z-index:1200!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom))!important;background:rgba(0,0,0,.76)!important;backdrop-filter:blur(7px)!important}
        .group-action-backdrop .group-tools-panel{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;bottom:auto!important;width:min(100%,520px)!important;max-height:min(84dvh,760px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;margin:0!important;padding:20px!important;border:1px solid #343941!important;border-radius:22px!important;background:#0b1014!important;box-shadow:0 24px 80px #000b!important;display:grid!important;gap:18px!important}
        .group-action-backdrop .group-tools-panel-head{position:sticky;top:-20px;z-index:2;margin:-20px -20px 0;padding:18px 20px;background:#0b1014;border-bottom:1px solid #20262b}
        .group-action-backdrop .group-tools-panel-head strong{font-size:19px!important;color:#f4f6f8!important}.group-action-backdrop .group-tools-panel-head small{font-size:12px!important;color:#8d969d!important}
        .group-action-backdrop .group-tools-panel-head button{width:36px!important;height:36px!important;flex:0 0 36px!important;border:0!important;background:#252b30!important;color:#e9edf0!important}
        .group-action-backdrop .group-tools-tabs button{min-height:92px!important;border-radius:15px!important;background:#171d22!important;border:1px solid #30383f!important}
        .group-action-backdrop .group-tool-editor{gap:10px!important}.group-action-backdrop .group-tool-editor label{margin-top:3px;color:#9da7ae!important;font-size:13px!important;font-weight:600!important}
        .group-action-backdrop .group-tool-editor input:not([type=checkbox]),.group-action-backdrop .group-tool-editor textarea{min-height:54px!important;padding:14px 15px!important;border:1px solid #384148!important;border-radius:12px!important;background:#11171b!important;color:#f5f7f8!important;font-size:15px!important;outline:none}
        .group-action-backdrop .group-tool-editor input:focus,.group-action-backdrop .group-tool-editor textarea:focus{border-color:#20bd68!important;box-shadow:0 0 0 2px #20bd6820!important}
        .group-action-backdrop .group-tool-editor textarea{min-height:100px!important}.group-action-backdrop .poll-counter{margin-top:-8px;text-align:right;color:#78838b;font-size:11px}
        .poll-option-fields{display:grid;gap:9px}.poll-option-row{display:flex;align-items:center;gap:8px}.poll-option-row input{flex:1;min-width:0}
        .poll-remove-option{width:34px;height:34px;flex:0 0 34px;border:0;border-radius:50%;background:#252d32;color:#b7c0c6;font-size:21px}
        .group-action-backdrop .poll-add-option{justify-self:start;padding:8px 0;border:0;background:transparent;color:#20bd68;font-size:14px;font-weight:600}
        .poll-setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #252d32;color:#e4e9ec;font-size:14px}
        .poll-setting-row input{appearance:none;width:48px;height:28px;flex:0 0 48px;border:0!important;border-radius:20px;background:#39434a!important;position:relative;cursor:pointer;transition:background .18s}
        .poll-setting-row input:before{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#e8ecef;transition:transform .18s}
        .poll-setting-row input:checked{background:#20bd68!important}.poll-setting-row input:checked:before{transform:translateX(20px)}
        .group-action-backdrop .poll-send-btn{min-height:52px!important;margin-top:4px!important;border-radius:14px!important;background:#20bd68!important;color:#07130c!important;font-size:16px!important;font-weight:700!important}
        .group-action-backdrop .poll-send-btn:disabled{opacity:.45}.group-feed-card .group-poll-option{background:#20282d;border-color:#39444b}.group-feed-card .group-poll-option.voted{background:#173d2b;border-color:#20bd68}
        @media(max-width:600px){.group-action-backdrop{padding:calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom))!important}.group-action-backdrop .group-tools-panel{width:100%!important;max-height:84dvh!important;border-radius:20px!important;padding:18px!important}.group-action-backdrop .group-tools-panel-head{top:-18px;margin:-18px -18px 0;padding:16px 18px}}
</style>
    </main>
  );
}
