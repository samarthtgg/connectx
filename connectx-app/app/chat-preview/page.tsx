"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, TouchEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
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
  edited_at?: string | null;
  message_type?: "text" | "voice" | "image" | "video";
  media_path?: string | null;
  media_expires_at?: string | null;
  media_expired?: boolean;
  expires_at?: string | null;
  media_url?: string | null;
};
type StatusUpdate = { id:string; user_id:string; caption:string|null; media_url:string|null; media_type:"text"|"image"|"video"; created_at:string; expires_at:string; };
type MessageReaction = { id: string; message_id: string; user_id: string; emoji: string };
type ChatPreference = { friend_id: string; cleared_at: string | null; hidden_at: string | null; is_pinned?: boolean; is_archived?: boolean; unread_at?: string | null; draft?: string | null };
type RecentChat = { profile: Profile; preview: string; lastMessageAt: string };
type ChatGroup = { id: string; name: string; description: string | null; avatar_url: string | null; created_by: string; created_at: string; my_role?: string };
type GroupMessage = { id: string; group_id: string; sender_id: string; content: string; created_at: string; edited_at: string | null; deleted_for_everyone: boolean; reply_to_id?: string | null; reply_to_content?: string | null; reply_to_sender_id?: string | null };

const displayName = (profile: Profile) =>
  profile.full_name?.trim() || profile.username || "ConnectX user";
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function VoiceMessagePlayer({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const bars = [5,10,17,25,13,31,20,11,27,18,8,23,14,29,17,9,24,14,7,19,11,26,15,8,20,12,6,17,10,5];
  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  };
  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setPlaying(false); }
    } else audio.pause();
  };
  const seek = (event: ReactMouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || !audio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * audio.duration;
  };
  return (
    <div className={`voice-message-player ${mine ? "voice-message-mine" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={e => { const audio=e.currentTarget; setCurrentTime(audio.currentTime); setProgress(audio.duration ? audio.currentTime/audio.duration : 0); }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); if(audioRef.current) audioRef.current.currentTime=0; }} />
      <button type="button" className="voice-play-button" onClick={() => void togglePlayback()} aria-label={playing ? "Pause voice message" : "Play voice message"}>
        {playing ? <span className="voice-pause-icon">Ⅱ</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.8 19 12 8 19.2Z" /></svg>}
      </button>
      <div className="voice-wave-track" role="progressbar" aria-label="Voice message playback" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)} onClick={seek}>
        <div className="voice-wave-fill" style={{width:`${progress*100}%`}} />
        <div className="voice-wave-bars">{bars.map((height,index)=><span key={index} style={{height:height+"px"}} />)}</div>
      </div>
      <span className="voice-time">{playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}</span>
    </div>
  );
}

const APP_LANGUAGES = [
  ["en","English"],["hi","हिन्दी"],["mr","मराठी"],["gu","ગુજરાતી"],["bn","বাংলা"],["ta","தமிழ்"],["te","తెలుగు"],["kn","ಕನ್ನಡ"],["ml","മലയാളം"],["pa","ਪੰਜਾਬੀ"],["ur","اردو"],["es","Español"],["fr","Français"],["de","Deutsch"],["pt","Português"],["ar","العربية"],["id","Bahasa Indonesia"],["ja","日本語"],["ko","한국어"],["zh","中文"]
] as const;
const APP_COPY: Record<string, Record<string,string>> = {
  en: {"Your space to connect":"Your space to connect","Search friends":"Search friends","Search exact username (e.g. @samarth)":"Search exact username (e.g. @samarth)","Refresh":"Refresh","Loading your account…":"Loading your account…","Updates":"Updates","Share what’s happening":"Share what’s happening","My status":"My status","Add":"Add","No recent updates":"No recent updates","When your friends share a status, it will appear here.":"When your friends share a status, it will appear here.","Recent updates":"Recent updates","Messages":"Messages","Status":"Status","Friends":"Friends","Settings":"Settings","Your name":"Your name","A little about you…":"A little about you…","{tr("Required before opening your locked chats. Uses your device's passkey prompt.")}":"Required before opening your locked chats. Uses your device's passkey prompt.","Set up again":"Set up again","Enable":"Enable","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.","Verification is configured on this device. Locked chats:":"Verification is configured on this device. Locked chats:","Privacy preference for future profile discovery controls":"Privacy preference for future profile discovery controls","Allow friends to see your last active time when presence is added":"Allow friends to see your last active time when presence is added","Saving language preference…":"Saving language preference…","Saving…":"Saving…","Current app release":"Current app release","CHAT LOCK":"CHAT LOCK","Lock":"Lock","Unlock":"Unlock","Locked private chat":"Locked private chat","Locked group":"Locked group","No locked chats yet.":"No locked chats yet.","CHATS":"CHATS","Back to chats":"Back to chats","Archive":"Archive","Restore":"Restore","Chat Lock":"Chat Lock","No archived chats.":"No archived chats.","No chats yet. Search for someone in Friends and send your first message.":"No chats yet. Search for someone in Friends and send your first message."}undefined
  hi: {"Messages":"संदेश","Status":"स्टेटस","Friends":"दोस्त","Settings":"सेटिंग्स","Your profile":"आपकी प्रोफ़ाइल","Appearance":"दिखावट","Dark mode":"डार्क मोड","Use a darker theme across ConnectX":"ConnectX में डार्क थीम इस्तेमाल करें","Chat lock & security":"चैट लॉक और सुरक्षा","Fingerprint / biometric verification":"फिंगरप्रिंट / बायोमेट्रिक सत्यापन","Privacy":"गोपनीयता","Private profile":"निजी प्रोफ़ाइल","Show last seen":"लास्ट सीन दिखाएं","Profile photo":"प्रोफ़ाइल फ़ोटो","Display name":"प्रदर्शित नाम","Username":"यूज़रनेम","Bio":"बायो","Save profile":"प्रोफ़ाइल सेव करें","Sign out":"लॉग आउट","Change language":"भाषा बदलें","Choose your app language":"ऐप की भाषा चुनें","Your space to connect":"जुड़ने की आपकी जगह","Search friends":"दोस्त खोजें","Search exact username (e.g. @samarth)":"सटीक यूज़रनेम खोजें (जैसे @samarth)","Refresh":"रीफ़्रेश करें","Loading your account…":"आपका अकाउंट लोड हो रहा है…","Updates":"अपडेट","Share what’s happening":"अपना हाल साझा करें","My status":"मेरा स्टेटस","Add":"जोड़ें","No recent updates":"कोई नया अपडेट नहीं","When your friends share a status, it will appear here.":"आपके दोस्तों के स्टेटस यहां दिखेंगे।","Recent updates":"हाल के अपडेट","Your name":"आपका नाम","A little about you…":"अपने बारे में कुछ लिखें…","Required before opening your locked chats. Uses your device's passkey prompt.":"लॉक की गई चैट खोलने से पहले ज़रूरी। आपके डिवाइस के पासकी प्रॉम्प्ट का उपयोग करता है।","Set up again":"फिर से सेट करें","Enable":"चालू करें","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"इस ब्राउज़र में बायोमेट्रिक/पासकी प्रमाणीकरण उपलब्ध नहीं है। स्क्रीन लॉक वाले डिवाइस पर समर्थित ब्राउज़र आज़माएँ।","Verification is configured on this device. Locked chats:":"इस डिवाइस पर सत्यापन सेट है। लॉक चैट:","Privacy preference for future profile discovery controls":"भविष्य में प्रोफ़ाइल खोजने की गोपनीयता सेटिंग","Allow friends to see your last active time when presence is added":"उपलब्धता सुविधा आने पर दोस्तों को आपका आख़िरी सक्रिय समय देखने दें","Saving language preference…":"भाषा सेटिंग सेव हो रही है…","Saving…":"सेव हो रहा है…","Current app release":"वर्तमान ऐप रिलीज़","CHAT LOCK":"चैट लॉक","Lock":"लॉक करें","Unlock":"अनलॉक करें","Locked private chat":"लॉक की गई निजी चैट","Locked group":"लॉक किया गया ग्रुप","No locked chats yet.":"अभी कोई लॉक चैट नहीं है।","CHATS":"चैट","Back to chats":"चैट पर वापस जाएँ","Archive":"आर्काइव","Restore":"बहाल करें","Chat Lock":"चैट लॉक","No archived chats.":"कोई आर्काइव चैट नहीं है।","No chats yet. Search for someone in Friends and send your first message.":"अभी कोई चैट नहीं है। Friends में किसी को खोजें और पहला संदेश भेजें।"}undefined
  mr: {"Messages":"संदेश","Status":"स्टेटस","Friends":"मित्र","Settings":"सेटिंग्ज","Your profile":"तुमची प्रोफाइल","Appearance":"दिसणे","Dark mode":"डार्क मोड","Use a darker theme across ConnectX":"ConnectX मध्ये डार्क थीम वापरा","Chat lock & security":"चॅट लॉक आणि सुरक्षा","Fingerprint / biometric verification":"फिंगरप्रिंट / बायोमेट्रिक पडताळणी","Privacy":"गोपनीयता","Private profile":"खाजगी प्रोफाइल","Show last seen":"शेवटचे पाहिलेले दाखवा","Profile photo":"प्रोफाइल फोटो","Display name":"दर्शविलेले नाव","Username":"वापरकर्तानाव","Bio":"माहिती","Save profile":"प्रोफाइल जतन करा","Sign out":"बाहेर पडा","Change language":"भाषा बदला","Choose your app language":"अॅपची भाषा निवडा","Your space to connect":"जोडण्यासाठी तुमची जागा","Search friends":"मित्र शोधा","Search exact username (e.g. @samarth)":"अचूक वापरकर्तानाव शोधा","Refresh":"रीफ्रेश करा","Loading your account…":"तुमचे खाते लोड होत आहे…","Updates":"अपडेट्स","Share what’s happening":"काय चालले आहे ते शेअर करा","My status":"माझा स्टेटस","Add":"जोडा","No recent updates":"अलीकडील अपडेट्स नाहीत","When your friends share a status, it will appear here.":"तुमचे मित्र स्टेटस शेअर करतील ते येथे दिसेल.","Recent updates":"अलीकडील अपडेट्स","Your name":"तुमचे नाव","A little about you…":"तुमच्याबद्दल थोडे लिहा…","Required before opening your locked chats. Uses your device's passkey prompt.":"लॉक केलेल्या चॅट उघडण्यापूर्वी आवश्यक. तुमच्या डिव्हाइसचा पासकी प्रॉम्प्ट वापरतो.","Set up again":"पुन्हा सेट करा","Enable":"सुरू करा","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"या ब्राउझरमध्ये बायोमेट्रिक/पासकी प्रमाणीकरण उपलब्ध नाही. स्क्रीन लॉक असलेल्या डिव्हाइसवर समर्थित ब्राउझर वापरा.","Verification is configured on this device. Locked chats:":"या डिव्हाइसवर पडताळणी सेट आहे. लॉक चॅट्स:","Privacy preference for future profile discovery controls":"भविष्यातील प्रोफाइल शोध गोपनीयता सेटिंग","Allow friends to see your last active time when presence is added":"उपस्थिती सुविधा सुरू झाल्यावर मित्रांना तुमची शेवटची सक्रिय वेळ पाहू द्या","Saving language preference…":"भाषेची सेटिंग जतन होत आहे…","Saving…":"जतन होत आहे…","Current app release":"सध्याची अॅप आवृत्ती","CHAT LOCK":"चॅट लॉक","Lock":"लॉक करा","Unlock":"अनलॉक करा","Locked private chat":"लॉक केलेली खाजगी चॅट","Locked group":"लॉक केलेला ग्रुप","No locked chats yet.":"अद्याप लॉक केलेल्या चॅट्स नाहीत.","CHATS":"चॅट्स","Back to chats":"चॅट्सकडे परत जा","Archive":"आर्काइव्ह","Restore":"पुनर्संचयित करा","Chat Lock":"चॅट लॉक","No archived chats.":"आर्काइव्ह केलेल्या चॅट्स नाहीत.","No chats yet. Search for someone in Friends and send your first message.":"अद्याप चॅट्स नाहीत. Friends मध्ये कोणाला शोधा आणि पहिला संदेश पाठवा."}undefined
  gu: {"Messages":"સંદેશા","Status":"સ્ટેટસ","Friends":"મિત્રો","Settings":"સેટિંગ્સ","Your profile":"તમારી પ્રોફાઇલ","Appearance":"દેખાવ","Dark mode":"ડાર્ક મોડ","Use a darker theme across ConnectX":"ConnectXમાં ડાર્ક થીમ વાપરો","Chat lock & security":"ચેટ લોક અને સુરક્ષા","Fingerprint / biometric verification":"ફિંગરપ્રિન્ટ / બાયોમેટ્રિક ચકાસણી","Privacy":"ગોપનીયતા","Private profile":"ખાનગી પ્રોફાઇલ","Show last seen":"છેલ્લે જોયું તે બતાવો","Profile photo":"પ્રોફાઇલ ફોટો","Display name":"દર્શાવવાનું નામ","Username":"વપરાશકર્તા નામ","Bio":"પરિચય","Save profile":"પ્રોફાઇલ સાચવો","Sign out":"સાઇન આઉટ","Change language":"ભાષા બદલો","Choose your app language":"એપની ભાષા પસંદ કરો","Your space to connect":"જોડાવા માટે તમારી જગ્યા","Search friends":"મિત્રો શોધો","Search exact username (e.g. @samarth)":"ચોક્કસ યુઝરનેમ શોધો","Refresh":"રિફ્રેશ કરો","Loading your account…":"તમારું એકાઉન્ટ લોડ થઈ રહ્યું છે…","Updates":"અપડેટ્સ","Share what’s happening":"શું ચાલી રહ્યું છે તે શેર કરો","My status":"મારું સ્ટેટસ","Add":"ઉમેરો","No recent updates":"કોઈ તાજેતરના અપડેટ્સ નથી","When your friends share a status, it will appear here.":"તમારા મિત્રો સ્ટેટસ શેર કરે ત્યારે અહીં દેખાશે.","Recent updates":"તાજેતરના અપડેટ્સ","Your name":"તમારું નામ","A little about you…":"તમારા વિશે થોડું લખો…","Required before opening your locked chats. Uses your device's passkey prompt.":"લૉક કરેલી ચેટ ખોલતા પહેલાં જરૂરી. તમારા ડિવાઇસના પાસકી પ્રોમ્પ્ટનો ઉપયોગ કરે છે.","Set up again":"ફરી સેટ કરો","Enable":"ચાલુ કરો","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"આ બ્રાઉઝરમાં બાયોમેટ્રિક/પાસકી ચકાસણી ઉપલબ્ધ નથી. સ્ક્રીન લૉકવાળા ડિવાઇસમાં સપોર્ટેડ બ્રાઉઝર અજમાવો.","Verification is configured on this device. Locked chats:":"આ ડિવાઇસમાં ચકાસણી સેટ છે. લૉક ચેટ્સ:","Privacy preference for future profile discovery controls":"આગામી પ્રોફાઇલ શોધ માટેની ગોપનીયતા સેટિંગ","Allow friends to see your last active time when presence is added":"ઉપસ્થિતિ સુવિધા ઉમેરાય ત્યારે મિત્રોને તમારો છેલ્લો સક્રિય સમય જોવા દો","Saving language preference…":"ભાષાની પસંદગી સાચવાઈ રહી છે…","Saving…":"સાચવી રહ્યું છે…","Current app release":"વર્તમાન એપ રિલીઝ","CHAT LOCK":"ચેટ લોક","Lock":"લોક કરો","Unlock":"અનલોક કરો","Locked private chat":"લૉક કરેલી ખાનગી ચેટ","Locked group":"લૉક કરેલો ગ્રુપ","No locked chats yet.":"હજુ કોઈ લૉક ચેટ નથી.","CHATS":"ચેટ્સ","Back to chats":"ચેટ્સ પર પાછા જાઓ","Archive":"આર્કાઇવ","Restore":"પુનઃસ્થાપિત કરો","Chat Lock":"ચેટ લોક","No archived chats.":"કોઈ આર્કાઇવ ચેટ નથી.","No chats yet. Search for someone in Friends and send your first message.":"હજુ કોઈ ચેટ નથી. Friends માં કોઈને શોધો અને પહેલો સંદેશ મોકલો."}undefined
  bn: {"Messages":"বার্তা","Status":"স্ট্যাটাস","Friends":"বন্ধুরা","Settings":"সেটিংস","Your profile":"আপনার প্রোফাইল","Appearance":"চেহারা","Dark mode":"ডার্ক মোড","Use a darker theme across ConnectX":"ConnectX-এ ডার্ক থিম ব্যবহার করুন","Chat lock & security":"চ্যাট লক ও নিরাপত্তা","Fingerprint / biometric verification":"ফিঙ্গারপ্রিন্ট / বায়োমেট্রিক যাচাই","Privacy":"গোপনীয়তা","Private profile":"ব্যক্তিগত প্রোফাইল","Show last seen":"শেষ দেখা দেখান","Profile photo":"প্রোফাইল ছবি","Display name":"প্রদর্শিত নাম","Username":"ব্যবহারকারীর নাম","Bio":"পরিচিতি","Save profile":"প্রোফাইল সংরক্ষণ করুন","Sign out":"সাইন আউট","Change language":"ভাষা পরিবর্তন করুন","Choose your app language":"অ্যাপের ভাষা বেছে নিন","Your space to connect":"সংযোগের জন্য আপনার জায়গা","Search friends":"বন্ধু খুঁজুন","Search exact username (e.g. @samarth)":"সঠিক ব্যবহারকারীর নাম খুঁজুন","Refresh":"রিফ্রেশ","Loading your account…":"আপনার অ্যাকাউন্ট লোড হচ্ছে…","Updates":"আপডেট","Share what’s happening":"কী ঘটছে শেয়ার করুন","My status":"আমার স্ট্যাটাস","Add":"যোগ করুন","No recent updates":"সাম্প্রতিক কোনো আপডেট নেই","When your friends share a status, it will appear here.":"বন্ধুরা স্ট্যাটাস শেয়ার করলে এখানে দেখা যাবে।","Recent updates":"সাম্প্রতিক আপডেট","Your name":"আপনার নাম","A little about you…":"আপনার সম্পর্কে কিছু লিখুন…","Required before opening your locked chats. Uses your device's passkey prompt.":"লক করা চ্যাট খোলার আগে প্রয়োজন। আপনার ডিভাইসের পাসকি প্রম্পট ব্যবহার করে।","Set up again":"আবার সেট আপ করুন","Enable":"চালু করুন","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"এই ব্রাউজারে বায়োমেট্রিক/পাসকি প্রমাণীকরণ উপলভ্য নয়। স্ক্রিন লক থাকা ডিভাইসে সমর্থিত ব্রাউজার ব্যবহার করুন।","Verification is configured on this device. Locked chats:":"এই ডিভাইসে যাচাইকরণ সেট করা আছে। লক করা চ্যাট:","Privacy preference for future profile discovery controls":"ভবিষ্যৎ প্রোফাইল খোঁজার গোপনীয়তা সেটিং","Allow friends to see your last active time when presence is added":"উপস্থিতি সুবিধা চালু হলে বন্ধুদের আপনার শেষ সক্রিয় সময় দেখতে দিন","Saving language preference…":"ভাষার পছন্দ সংরক্ষণ হচ্ছে…","Saving…":"সংরক্ষণ হচ্ছে…","Current app release":"বর্তমান অ্যাপ রিলিজ","CHAT LOCK":"চ্যাট লক","Lock":"লক করুন","Unlock":"আনলক করুন","Locked private chat":"লক করা ব্যক্তিগত চ্যাট","Locked group":"লক করা গ্রুপ","No locked chats yet.":"এখনও কোনো লক করা চ্যাট নেই।","CHATS":"চ্যাট","Back to chats":"চ্যাটে ফিরে যান","Archive":"আর্কাইভ","Restore":"পুনরুদ্ধার করুন","Chat Lock":"চ্যাট লক","No archived chats.":"কোনো আর্কাইভ করা চ্যাট নেই।","No chats yet. Search for someone in Friends and send your first message.":"এখনও কোনো চ্যাট নেই। Friends-এ কাউকে খুঁজে প্রথম বার্তা পাঠান।"}undefined
  ta: {"Messages":"செய்திகள்","Status":"நிலை","Friends":"நண்பர்கள்","Settings":"அமைப்புகள்","Your profile":"உங்கள் சுயவிவரம்","Appearance":"தோற்றம்","Dark mode":"இருண்ட பயன்முறை","Use a darker theme across ConnectX":"ConnectX முழுவதும் இருண்ட தீம் பயன்படுத்தவும்","Chat lock & security":"அரட்டை பூட்டு மற்றும் பாதுகாப்பு","Fingerprint / biometric verification":"கைரேகை / பயோமெட்ரிக் சரிபார்ப்பு","Privacy":"தனியுரிமை","Private profile":"தனிப்பட்ட சுயவிவரம்","Show last seen":"கடைசியாக பார்த்ததை காட்டு","Profile photo":"சுயவிவரப் படம்","Display name":"காட்சிப் பெயர்","Username":"பயனர்பெயர்","Bio":"அறிமுகம்","Save profile":"சுயவிவரத்தை சேமி","Sign out":"வெளியேறு","Change language":"மொழியை மாற்று","Choose your app language":"பயன்பாட்டு மொழியைத் தேர்ந்தெடுக்கவும்","Your space to connect":"இணைவதற்கான உங்கள் இடம்","Search friends":"நண்பர்களைத் தேடுங்கள்","Search exact username (e.g. @samarth)":"சரியான பயனர்பெயரைத் தேடுங்கள்","Refresh":"புதுப்பிக்கவும்","Loading your account…":"உங்கள் கணக்கு ஏற்றப்படுகிறது…","Updates":"புதுப்பிப்புகள்","Share what’s happening":"என்ன நடக்கிறது என்பதைப் பகிரவும்","My status":"எனது நிலை","Add":"சேர்","No recent updates":"சமீபத்திய புதுப்பிப்புகள் இல்லை","When your friends share a status, it will appear here.":"உங்கள் நண்பர்கள் நிலையைப் பகிரும்போது இங்கே தோன்றும்.","Recent updates":"சமீபத்திய புதுப்பிப்புகள்","Your name":"உங்கள் பெயர்","A little about you…":"உங்களைப் பற்றி சிறிது எழுதுங்கள்…","Required before opening your locked chats. Uses your device's passkey prompt.":"பூட்டிய அரட்டைகளைத் திறப்பதற்கு முன் தேவை. உங்கள் சாதனத்தின் பாஸ்கீ அறிவிப்பைப் பயன்படுத்தும்.","Set up again":"மீண்டும் அமைக்கவும்","Enable":"இயக்கு","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"இந்த உலாவியில் பயோமெட்ரிக்/பாஸ்கீ அங்கீகாரம் இல்லை. திரைப் பூட்டு உள்ள சாதனத்தில் ஆதரிக்கப்படும் உலாவியைப் பயன்படுத்தவும்.","Verification is configured on this device. Locked chats:":"இந்தச் சாதனத்தில் சரிபார்ப்பு அமைக்கப்பட்டுள்ளது. பூட்டிய அரட்டைகள்:","Privacy preference for future profile discovery controls":"எதிர்கால சுயவிவரத் தேடலுக்கான தனியுரிமை அமைப்பு","Allow friends to see your last active time when presence is added":"இருப்பு அம்சம் சேர்க்கப்படும்போது நண்பர்கள் கடைசியாகச் செயல்பட்ட நேரத்தைப் பார்க்க அனுமதிக்கவும்","Saving language preference…":"மொழி விருப்பம் சேமிக்கப்படுகிறது…","Saving…":"சேமிக்கப்படுகிறது…","Current app release":"தற்போதைய செயலி வெளியீடு","CHAT LOCK":"அரட்டை பூட்டு","Lock":"பூட்டு","Unlock":"திற","Locked private chat":"பூட்டிய தனிப்பட்ட அரட்டை","Locked group":"பூட்டிய குழு","No locked chats yet.":"பூட்டிய அரட்டைகள் எதுவும் இல்லை.","CHATS":"அரட்டைகள்","Back to chats":"அரட்டைகளுக்குத் திரும்பு","Archive":"காப்பகம்","Restore":"மீட்டமை","Chat Lock":"அரட்டை பூட்டு","No archived chats.":"காப்பக அரட்டைகள் இல்லை.","No chats yet. Search for someone in Friends and send your first message.":"அரட்டைகள் இல்லை. Friends-இல் ஒருவரைத் தேடி முதல் செய்தியை அனுப்புங்கள்."}undefined
  te: {"Messages":"సందేశాలు","Status":"స్థితి","Friends":"స్నేహితులు","Settings":"సెట్టింగ్‌లు","Your profile":"మీ ప్రొఫైల్","Appearance":"రూపం","Dark mode":"డార్క్ మోడ్","Use a darker theme across ConnectX":"ConnectX అంతటా డార్క్ థీమ్ ఉపయోగించండి","Chat lock & security":"చాట్ లాక్ మరియు భద్రత","Fingerprint / biometric verification":"వేలిముద్ర / బయోమెట్రిక్ ధృవీకరణ","Privacy":"గోప్యత","Private profile":"ప్రైవేట్ ప్రొఫైల్","Show last seen":"చివరిగా చూసిన సమయాన్ని చూపు","Profile photo":"ప్రొఫైల్ ఫోటో","Display name":"ప్రదర్శన పేరు","Username":"వినియోగదారు పేరు","Bio":"బయో","Save profile":"ప్రొఫైల్ సేవ్ చేయి","Sign out":"సైన్ అవుట్","Change language":"భాష మార్చండి","Choose your app language":"యాప్ భాషను ఎంచుకోండి","Your space to connect":"కనెక్ట్ కావడానికి మీ స్థలం","Search friends":"స్నేహితులను వెతకండి","Search exact username (e.g. @samarth)":"ఖచ్చితమైన వినియోగదారు పేరును వెతకండి","Refresh":"రిఫ్రెష్","Loading your account…":"మీ ఖాతా లోడ్ అవుతోంది…","Updates":"అప్‌డేట్‌లు","Share what’s happening":"ఏం జరుగుతుందో పంచుకోండి","My status":"నా స్థితి","Add":"జోడించు","No recent updates":"ఇటీవలి అప్‌డేట్‌లు లేవు","When your friends share a status, it will appear here.":"మీ స్నేహితులు స్థితిని పంచుకున్నప్పుడు ఇక్కడ కనిపిస్తుంది.","Recent updates":"ఇటీవలి అప్‌డేట్‌లు","Your name":"మీ పేరు","A little about you…":"మీ గురించి కొంచెం రాయండి…","Required before opening your locked chats. Uses your device's passkey prompt.":"లాక్ చేసిన చాట్‌లను తెరవడానికి ముందు అవసరం. మీ పరికరం పాస్‌కీ ప్రాంప్ట్‌ను ఉపయోగిస్తుంది.","Set up again":"మళ్లీ సెటప్ చేయండి","Enable":"ప్రారంభించు","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"ఈ బ్రౌజర్‌లో బయోమెట్రిక్/పాస్‌కీ ప్రమాణీకరణ అందుబాటులో లేదు. స్క్రీన్ లాక్ ఉన్న పరికరంలో మద్దతు ఉన్న బ్రౌజర్‌ను ప్రయత్నించండి.","Verification is configured on this device. Locked chats:":"ఈ పరికరంలో ధృవీకరణ సెటప్ చేయబడింది. లాక్ చేసిన చాట్‌లు:","Privacy preference for future profile discovery controls":"భవిష్యత్ ప్రొఫైల్ శోధన గోప్యత సెట్టింగ్","Allow friends to see your last active time when presence is added":"ప్రెజెన్స్ ఫీచర్ వచ్చినప్పుడు స్నేహితులు మీ చివరి యాక్టివ్ సమయాన్ని చూడటానికి అనుమతించండి","Saving language preference…":"భాష ప్రాధాన్యత సేవ్ అవుతోంది…","Saving…":"సేవ్ అవుతోంది…","Current app release":"ప్రస్తుత యాప్ విడుదల","CHAT LOCK":"చాట్ లాక్","Lock":"లాక్ చేయి","Unlock":"అన్‌లాక్ చేయి","Locked private chat":"లాక్ చేసిన ప్రైవేట్ చాట్","Locked group":"లాక్ చేసిన గ్రూప్","No locked chats yet.":"ఇంకా లాక్ చేసిన చాట్‌లు లేవు.","CHATS":"చాట్‌లు","Back to chats":"చాట్‌లకు తిరిగి వెళ్లు","Archive":"ఆర్కైవ్","Restore":"పునరుద్ధరించు","Chat Lock":"చాట్ లాక్","No archived chats.":"ఆర్కైవ్ చేసిన చాట్‌లు లేవు.","No chats yet. Search for someone in Friends and send your first message.":"ఇంకా చాట్‌లు లేవు. Friendsలో ఒకరిని వెతికి మొదటి సందేశం పంపండి."}undefined
  kn: {"Messages":"ಸಂದೇಶಗಳು","Status":"ಸ್ಥಿತಿ","Friends":"ಸ್ನೇಹಿತರು","Settings":"ಸೆಟ್ಟಿಂಗ್‌ಗಳು","Your profile":"ನಿಮ್ಮ ಪ್ರೊಫೈಲ್","Appearance":"ಗೋಚರತೆ","Dark mode":"ಡಾರ್ಕ್ ಮೋಡ್","Use a darker theme across ConnectX":"ConnectX ನಲ್ಲಿ ಡಾರ್ಕ್ ಥೀಮ್ ಬಳಸಿ","Chat lock & security":"ಚಾಟ್ ಲಾಕ್ ಮತ್ತು ಭದ್ರತೆ","Fingerprint / biometric verification":"ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ / ಬಯೋಮೆಟ್ರಿಕ್ ಪರಿಶೀಲನೆ","Privacy":"ಗೌಪ್ಯತೆ","Private profile":"ಖಾಸಗಿ ಪ್ರೊಫೈಲ್","Show last seen":"ಕೊನೆಯದಾಗಿ ನೋಡಿದ ಸಮಯ ತೋರಿಸಿ","Profile photo":"ಪ್ರೊಫೈಲ್ ಫೋಟೋ","Display name":"ಪ್ರದರ್ಶನ ಹೆಸರು","Username":"ಬಳಕೆದಾರ ಹೆಸರು","Bio":"ಪರಿಚಯ","Save profile":"ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ","Sign out":"ಸೈನ್ ಔಟ್","Change language":"ಭಾಷೆ ಬದಲಿಸಿ","Choose your app language":"ಆ್ಯಪ್ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ","Your space to connect":"ಸಂಪರ್ಕಿಸಲು ನಿಮ್ಮ ಸ್ಥಳ","Search friends":"ಸ್ನೇಹಿತರನ್ನು ಹುಡುಕಿ","Search exact username (e.g. @samarth)":"ನಿಖರ ಬಳಕೆದಾರ ಹೆಸರನ್ನು ಹುಡುಕಿ","Refresh":"ಮರುಲೋಡ್","Loading your account…":"ನಿಮ್ಮ ಖಾತೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ…","Updates":"ಅಪ್‌ಡೇಟ್‌ಗಳು","Share what’s happening":"ಏನಾಗುತ್ತಿದೆ ಎಂದು ಹಂಚಿಕೊಳ್ಳಿ","My status":"ನನ್ನ ಸ್ಥಿತಿ","Add":"ಸೇರಿಸಿ","No recent updates":"ಇತ್ತೀಚಿನ ಅಪ್‌ಡೇಟ್‌ಗಳಿಲ್ಲ","When your friends share a status, it will appear here.":"ನಿಮ್ಮ ಸ್ನೇಹಿತರು ಸ್ಥಿತಿ ಹಂಚಿಕೊಂಡಾಗ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.","Recent updates":"ಇತ್ತೀಚಿನ ಅಪ್‌ಡೇಟ್‌ಗಳು","Your name":"ನಿಮ್ಮ ಹೆಸರು","A little about you…":"ನಿಮ್ಮ ಬಗ್ಗೆ ಸ್ವಲ್ಪ ಬರೆಯಿರಿ…","Required before opening your locked chats. Uses your device's passkey prompt.":"ಲಾಕ್ ಮಾಡಿದ ಚಾಟ್‌ಗಳನ್ನು ತೆರೆಯುವ ಮೊದಲು ಅಗತ್ಯ. ನಿಮ್ಮ ಸಾಧನದ ಪಾಸ್‌ಕಿ ಪ್ರಾಂಪ್ಟ್ ಬಳಸುತ್ತದೆ.","Set up again":"ಮತ್ತೆ ಹೊಂದಿಸಿ","Enable":"ಸಕ್ರಿಯಗೊಳಿಸಿ","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಬಯೋಮೆಟ್ರಿಕ್/ಪಾಸ್‌ಕಿ ದೃಢೀಕರಣ ಲಭ್ಯವಿಲ್ಲ. ಸ್ಕ್ರೀನ್ ಲಾಕ್ ಇರುವ ಸಾಧನದಲ್ಲಿ ಬೆಂಬಲಿತ ಬ್ರೌಸರ್ ಬಳಸಿ.","Verification is configured on this device. Locked chats:":"ಈ ಸಾಧನದಲ್ಲಿ ಪರಿಶೀಲನೆ ಹೊಂದಿಸಲಾಗಿದೆ. ಲಾಕ್ ಮಾಡಿದ ಚಾಟ್‌ಗಳು:","Privacy preference for future profile discovery controls":"ಭವಿಷ್ಯದ ಪ್ರೊಫೈಲ್ ಹುಡುಕಾಟದ ಗೌಪ್ಯತಾ ಸೆಟ್ಟಿಂಗ್","Allow friends to see your last active time when presence is added":"ಉಪಸ್ಥಿತಿ ವೈಶಿಷ್ಟ್ಯ ಬಂದಾಗ ಸ್ನೇಹಿತರಿಗೆ ನಿಮ್ಮ ಕೊನೆಯ ಸಕ್ರಿಯ ಸಮಯ ನೋಡಲು ಅನುಮತಿಸಿ","Saving language preference…":"ಭಾಷೆಯ ಆಯ್ಕೆ ಉಳಿಸಲಾಗುತ್ತಿದೆ…","Saving…":"ಉಳಿಸಲಾಗುತ್ತಿದೆ…","Current app release":"ಪ್ರಸ್ತುತ ಆ್ಯಪ್ ಬಿಡುಗಡೆ","CHAT LOCK":"ಚಾಟ್ ಲಾಕ್","Lock":"ಲಾಕ್ ಮಾಡಿ","Unlock":"ಅನ್‌ಲಾಕ್ ಮಾಡಿ","Locked private chat":"ಲಾಕ್ ಮಾಡಿದ ಖಾಸಗಿ ಚಾಟ್","Locked group":"ಲಾಕ್ ಮಾಡಿದ ಗುಂಪು","No locked chats yet.":"ಇನ್ನೂ ಲಾಕ್ ಮಾಡಿದ ಚಾಟ್‌ಗಳಿಲ್ಲ.","CHATS":"ಚಾಟ್‌ಗಳು","Back to chats":"ಚಾಟ್‌ಗಳಿಗೆ ಹಿಂತಿರುಗಿ","Archive":"ಆರ್ಕೈವ್","Restore":"ಮರುಸ್ಥಾಪಿಸಿ","Chat Lock":"ಚಾಟ್ ಲಾಕ್","No archived chats.":"ಆರ್ಕೈವ್ ಮಾಡಿದ ಚಾಟ್‌ಗಳಿಲ್ಲ.","No chats yet. Search for someone in Friends and send your first message.":"ಇನ್ನೂ ಚಾಟ್‌ಗಳಿಲ್ಲ. Friends ನಲ್ಲಿ ಯಾರನ್ನಾದರೂ ಹುಡುಕಿ ಮೊದಲ ಸಂದೇಶ ಕಳುಹಿಸಿ."}undefined
  ml: {"Messages":"സന്ദേശങ്ങൾ","Status":"നില","Friends":"സുഹൃത്തുക്കൾ","Settings":"ക്രമീകരണങ്ങൾ","Your profile":"നിങ്ങളുടെ പ്രൊഫൈൽ","Appearance":"രൂപഭാവം","Dark mode":"ഡാർക്ക് മോഡ്","Use a darker theme across ConnectX":"ConnectX-ൽ ഡാർക്ക് തീം ഉപയോഗിക്കുക","Chat lock & security":"ചാറ്റ് ലോക്കും സുരക്ഷയും","Fingerprint / biometric verification":"വിരലടയാളം / ബയോമെട്രിക് പരിശോധന","Privacy":"സ്വകാര്യത","Private profile":"സ്വകാര്യ പ്രൊഫൈൽ","Show last seen":"അവസാനം കണ്ടത് കാണിക്കുക","Profile photo":"പ്രൊഫൈൽ ചിത്രം","Display name":"പ്രദർശന നാമം","Username":"ഉപയോക്തൃനാമം","Bio":"വിവരണം","Save profile":"പ്രൊഫൈൽ സംരക്ഷിക്കുക","Sign out":"സൈൻ ഔട്ട്","Change language":"ഭാഷ മാറ്റുക","Choose your app language":"ആപ്പിന്റെ ഭാഷ തിരഞ്ഞെടുക്കുക","Your space to connect":"ബന്ധപ്പെടാനുള്ള നിങ്ങളുടെ ഇടം","Search friends":"സുഹൃത്തുക്കളെ തിരയുക","Search exact username (e.g. @samarth)":"കൃത്യമായ ഉപയോക്തൃനാമം തിരയുക","Refresh":"പുതുക്കുക","Loading your account…":"നിങ്ങളുടെ അക്കൗണ്ട് ലോഡ് ചെയ്യുന്നു…","Updates":"അപ്‌ഡേറ്റുകൾ","Share what’s happening":"എന്താണ് സംഭവിക്കുന്നതെന്ന് പങ്കിടുക","My status":"എന്റെ സ്റ്റാറ്റസ്","Add":"ചേർക്കുക","No recent updates":"പുതിയ അപ്‌ഡേറ്റുകളില്ല","When your friends share a status, it will appear here.":"സുഹൃത്തുക്കൾ സ്റ്റാറ്റസ് പങ്കിടുമ്പോൾ ഇവിടെ കാണാം.","Recent updates":"സമീപകാല അപ്‌ഡേറ്റുകൾ","Your name":"നിങ്ങളുടെ പേര്","A little about you…":"നിങ്ങളെക്കുറിച്ച് കുറച്ച് എഴുതൂ…","Required before opening your locked chats. Uses your device's passkey prompt.":"ലോക്ക് ചെയ്ത ചാറ്റുകൾ തുറക്കുന്നതിന് മുമ്പ് ആവശ്യമാണ്. നിങ്ങളുടെ ഉപകരണത്തിലെ പാസ്‌കീ പ്രോംപ്റ്റ് ഉപയോഗിക്കുന്നു.","Set up again":"വീണ്ടും സജ്ജമാക്കുക","Enable":"പ്രവർത്തനക്ഷമമാക്കുക","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"ഈ ബ്രൗസറിൽ ബയോമെട്രിക്/പാസ്‌കീ പരിശോധന ലഭ്യമല്ല. സ്ക്രീൻ ലോക്കുള്ള ഉപകരണത്തിൽ പിന്തുണയ്ക്കുന്ന ബ്രൗസർ ഉപയോഗിക്കുക.","Verification is configured on this device. Locked chats:":"ഈ ഉപകരണത്തിൽ പരിശോധന ക്രമീകരിച്ചിട്ടുണ്ട്. ലോക്ക് ചെയ്ത ചാറ്റുകൾ:","Privacy preference for future profile discovery controls":"ഭാവിയിലെ പ്രൊഫൈൽ കണ്ടെത്തൽ സ്വകാര്യതാ ക്രമീകരണം","Allow friends to see your last active time when presence is added":"പ്രസൻസ് സൗകര്യം വരുമ്പോൾ സുഹൃത്തുക്കൾക്ക് അവസാന സജീവ സമയം കാണാൻ അനുവദിക്കുക","Saving language preference…":"ഭാഷാ മുൻഗണന സംരക്ഷിക്കുന്നു…","Saving…":"സംരക്ഷിക്കുന്നു…","Current app release":"നിലവിലെ ആപ്പ് പതിപ്പ്","CHAT LOCK":"ചാറ്റ് ലോക്ക്","Lock":"ലോക്ക് ചെയ്യുക","Unlock":"അൺലോക്ക് ചെയ്യുക","Locked private chat":"ലോക്ക് ചെയ്ത സ്വകാര്യ ചാറ്റ്","Locked group":"ലോക്ക് ചെയ്ത ഗ്രൂപ്പ്","No locked chats yet.":"ലോക്ക് ചെയ്ത ചാറ്റുകളൊന്നുമില്ല.","CHATS":"ചാറ്റുകൾ","Back to chats":"ചാറ്റുകളിലേക്ക് മടങ്ങുക","Archive":"ആർക്കൈവ്","Restore":"പുനഃസ്ഥാപിക്കുക","Chat Lock":"ചാറ്റ് ലോക്ക്","No archived chats.":"ആർക്കൈവ് ചെയ്ത ചാറ്റുകളില്ല.","No chats yet. Search for someone in Friends and send your first message.":"ചാറ്റുകളൊന്നുമില്ല. Friends-ൽ ഒരാളെ തിരഞ്ഞ് ആദ്യ സന്ദേശം അയയ്ക്കുക."}undefined
  pa: {"Messages":"ਸੁਨੇਹੇ","Status":"ਸਥਿਤੀ","Friends":"ਦੋਸਤ","Settings":"ਸੈਟਿੰਗਾਂ","Your profile":"ਤੁਹਾਡੀ ਪ੍ਰੋਫ਼ਾਈਲ","Appearance":"ਦਿੱਖ","Dark mode":"ਡਾਰਕ ਮੋਡ","Use a darker theme across ConnectX":"ConnectX ਵਿੱਚ ਡਾਰਕ ਥੀਮ ਵਰਤੋ","Chat lock & security":"ਚੈਟ ਲੌਕ ਅਤੇ ਸੁਰੱਖਿਆ","Fingerprint / biometric verification":"ਫਿੰਗਰਪ੍ਰਿੰਟ / ਬਾਇਓਮੈਟ੍ਰਿਕ ਪੁਸ਼ਟੀ","Privacy":"ਪਰਦੇਦਾਰੀ","Private profile":"ਨਿੱਜੀ ਪ੍ਰੋਫ਼ਾਈਲ","Show last seen":"ਆਖਰੀ ਵਾਰ ਦੇਖਿਆ ਦਿਖਾਓ","Profile photo":"ਪ੍ਰੋਫ਼ਾਈਲ ਫੋਟੋ","Display name":"ਦਿਖਾਇਆ ਜਾਣ ਵਾਲਾ ਨਾਮ","Username":"ਯੂਜ਼ਰਨੇਮ","Bio":"ਜਾਣ-ਪਛਾਣ","Save profile":"ਪ੍ਰੋਫ਼ਾਈਲ ਸੰਭਾਲੋ","Sign out":"ਸਾਈਨ ਆਉਟ","Change language":"ਭਾਸ਼ਾ ਬਦਲੋ","Choose your app language":"ਐਪ ਦੀ ਭਾਸ਼ਾ ਚੁਣੋ","Your space to connect":"ਜੁੜਨ ਲਈ ਤੁਹਾਡੀ ਥਾਂ","Search friends":"ਦੋਸਤ ਲੱਭੋ","Search exact username (e.g. @samarth)":"ਸਹੀ ਯੂਜ਼ਰਨੇਮ ਲੱਭੋ","Refresh":"ਤਾਜ਼ਾ ਕਰੋ","Loading your account…":"ਤੁਹਾਡਾ ਖਾਤਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…","Updates":"ਅੱਪਡੇਟ","Share what’s happening":"ਕੀ ਹੋ ਰਿਹਾ ਹੈ ਸਾਂਝਾ ਕਰੋ","My status":"ਮੇਰਾ ਸਟੇਟਸ","Add":"ਸ਼ਾਮਲ ਕਰੋ","No recent updates":"ਕੋਈ ਨਵਾਂ ਅੱਪਡੇਟ ਨਹੀਂ","When your friends share a status, it will appear here.":"ਜਦੋਂ ਤੁਹਾਡੇ ਦੋਸਤ ਸਟੇਟਸ ਸਾਂਝਾ ਕਰਨਗੇ ਤਾਂ ਇੱਥੇ ਦਿਖੇਗਾ।","Recent updates":"ਹਾਲੀਆ ਅੱਪਡੇਟ","Your name":"ਤੁਹਾਡਾ ਨਾਮ","A little about you…":"ਆਪਣੇ ਬਾਰੇ ਕੁਝ ਲਿਖੋ…","Required before opening your locked chats. Uses your device's passkey prompt.":"ਲੌਕ ਕੀਤੀਆਂ ਚੈਟਾਂ ਖੋਲ੍ਹਣ ਤੋਂ ਪਹਿਲਾਂ ਲਾਜ਼ਮੀ। ਤੁਹਾਡੇ ਡਿਵਾਈਸ ਦਾ ਪਾਸਕੀ ਪ੍ਰੌਂਪਟ ਵਰਤਦਾ ਹੈ।","Set up again":"ਦੁਬਾਰਾ ਸੈੱਟ ਕਰੋ","Enable":"ਚਾਲੂ ਕਰੋ","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਬਾਇਓਮੈਟ੍ਰਿਕ/ਪਾਸਕੀ ਪ੍ਰਮਾਣਿਕਤਾ ਉਪਲਬਧ ਨਹੀਂ। ਸਕ੍ਰੀਨ ਲੌਕ ਵਾਲੇ ਡਿਵਾਈਸ 'ਤੇ ਸਮਰਥਿਤ ਬ੍ਰਾਊਜ਼ਰ ਵਰਤੋ।","Verification is configured on this device. Locked chats:":"ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਪੁਸ਼ਟੀ ਸੈੱਟ ਹੈ। ਲੌਕ ਚੈਟਾਂ:","Privacy preference for future profile discovery controls":"ਭਵਿੱਖ ਵਿੱਚ ਪ੍ਰੋਫਾਈਲ ਖੋਜ ਲਈ ਪਰਦੇਦਾਰੀ ਸੈਟਿੰਗ","Allow friends to see your last active time when presence is added":"ਮੌਜੂਦਗੀ ਫੀਚਰ ਆਉਣ 'ਤੇ ਦੋਸਤਾਂ ਨੂੰ ਤੁਹਾਡਾ ਆਖਰੀ ਸਰਗਰਮ ਸਮਾਂ ਦੇਖਣ ਦਿਓ","Saving language preference…":"ਭਾਸ਼ਾ ਦੀ ਚੋਣ ਸੰਭਾਲੀ ਜਾ ਰਹੀ ਹੈ…","Saving…":"ਸੰਭਾਲਿਆ ਜਾ ਰਿਹਾ ਹੈ…","Current app release":"ਮੌਜੂਦਾ ਐਪ ਰਿਲੀਜ਼","CHAT LOCK":"ਚੈਟ ਲੌਕ","Lock":"ਲੌਕ ਕਰੋ","Unlock":"ਅਨਲੌਕ ਕਰੋ","Locked private chat":"ਲੌਕ ਕੀਤੀ ਨਿੱਜੀ ਚੈਟ","Locked group":"ਲੌਕ ਕੀਤਾ ਗਰੁੱਪ","No locked chats yet.":"ਹਾਲੇ ਕੋਈ ਲੌਕ ਚੈਟ ਨਹੀਂ।","CHATS":"ਚੈਟਾਂ","Back to chats":"ਚੈਟਾਂ 'ਤੇ ਵਾਪਸ ਜਾਓ","Archive":"ਆਰਕਾਈਵ","Restore":"ਮੁੜ ਬਹਾਲ ਕਰੋ","Chat Lock":"ਚੈਟ ਲੌਕ","No archived chats.":"ਕੋਈ ਆਰਕਾਈਵ ਚੈਟ ਨਹੀਂ।","No chats yet. Search for someone in Friends and send your first message.":"ਹਾਲੇ ਕੋਈ ਚੈਟ ਨਹੀਂ। Friends ਵਿੱਚ ਕਿਸੇ ਨੂੰ ਲੱਭੋ ਅਤੇ ਪਹਿਲਾ ਸੁਨੇਹਾ ਭੇਜੋ।"}undefined
  ur: {"Messages":"پیغامات","Status":"اسٹیٹس","Friends":"دوست","Settings":"ترتیبات","Your profile":"آپ کی پروفائل","Appearance":"ظاہری شکل","Dark mode":"ڈارک موڈ","Use a darker theme across ConnectX":"ConnectX میں ڈارک تھیم استعمال کریں","Chat lock & security":"چیٹ لاک اور سیکیورٹی","Fingerprint / biometric verification":"فنگر پرنٹ / بائیومیٹرک تصدیق","Privacy":"رازداری","Private profile":"نجی پروفائل","Show last seen":"آخری بار دیکھا دکھائیں","Profile photo":"پروفائل تصویر","Display name":"ظاہر ہونے والا نام","Username":"صارف نام","Bio":"تعارف","Save profile":"پروفائل محفوظ کریں","Sign out":"سائن آؤٹ","Change language":"زبان تبدیل کریں","Choose your app language":"ایپ کی زبان منتخب کریں","Your space to connect":"رابطے کے لیے آپ کی جگہ","Search friends":"دوست تلاش کریں","Search exact username (e.g. @samarth)":"درست صارف نام تلاش کریں","Refresh":"ریفریش کریں","Loading your account…":"آپ کا اکاؤنٹ لوڈ ہو رہا ہے…","Updates":"اپ ڈیٹس","Share what’s happening":"اپنی سرگرمی شیئر کریں","My status":"میرا اسٹیٹس","Add":"شامل کریں","No recent updates":"کوئی نئی اپ ڈیٹ نہیں","When your friends share a status, it will appear here.":"آپ کے دوستوں کے اسٹیٹس یہاں دکھائی دیں گے۔","Recent updates":"حالیہ اپ ڈیٹس","Your name":"آپ کا نام","A little about you…":"اپنے بارے میں کچھ لکھیں…","Required before opening your locked chats. Uses your device's passkey prompt.":"لاک شدہ چیٹس کھولنے سے پہلے ضروری ہے۔ آپ کے ڈیوائس کا پاس کی پرامپٹ استعمال کرتا ہے۔","Set up again":"دوبارہ ترتیب دیں","Enable":"فعال کریں","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"اس براؤزر میں بائیومیٹرک/پاس کی تصدیق دستیاب نہیں۔ اسکرین لاک والے ڈیوائس پر معاون براؤزر استعمال کریں۔","Verification is configured on this device. Locked chats:":"اس ڈیوائس پر تصدیق ترتیب دی گئی ہے۔ لاک چیٹس:","Privacy preference for future profile discovery controls":"مستقبل میں پروفائل تلاش کرنے کی رازداری کی ترتیب","Allow friends to see your last active time when presence is added":"پریزنس فیچر آنے پر دوستوں کو آپ کا آخری فعال وقت دیکھنے دیں","Saving language preference…":"زبان کی ترجیح محفوظ ہو رہی ہے…","Saving…":"محفوظ ہو رہا ہے…","Current app release":"موجودہ ایپ ریلیز","CHAT LOCK":"چیٹ لاک","Lock":"لاک کریں","Unlock":"ان لاک کریں","Locked private chat":"لاک شدہ نجی چیٹ","Locked group":"لاک شدہ گروپ","No locked chats yet.":"ابھی کوئی لاک چیٹ نہیں۔","CHATS":"چیٹس","Back to chats":"چیٹس پر واپس جائیں","Archive":"آرکائیو","Restore":"بحال کریں","Chat Lock":"چیٹ لاک","No archived chats.":"کوئی آرکائیو چیٹ نہیں۔","No chats yet. Search for someone in Friends and send your first message.":"ابھی کوئی چیٹ نہیں۔ Friends میں کسی کو تلاش کریں اور پہلا پیغام بھیجیں۔"}undefined
  es: {"Messages":"Mensajes","Status":"Estado","Friends":"Amigos","Settings":"Ajustes","Your profile":"Tu perfil","Appearance":"Apariencia","Dark mode":"Modo oscuro","Use a darker theme across ConnectX":"Usa un tema oscuro en ConnectX","Chat lock & security":"Bloqueo y seguridad del chat","Fingerprint / biometric verification":"Verificación por huella / biométrica","Privacy":"Privacidad","Private profile":"Perfil privado","Show last seen":"Mostrar última conexión","Profile photo":"Foto de perfil","Display name":"Nombre visible","Username":"Nombre de usuario","Bio":"Biografía","Save profile":"Guardar perfil","Sign out":"Cerrar sesión","Change language":"Cambiar idioma","Choose your app language":"Elige el idioma de la aplicación","Your space to connect":"Tu espacio para conectar","Search friends":"Buscar amigos","Search exact username (e.g. @samarth)":"Buscar nombre de usuario exacto","Refresh":"Actualizar","Loading your account…":"Cargando tu cuenta…","Updates":"Novedades","Share what’s happening":"Comparte lo que pasa","My status":"Mi estado","Add":"Añadir","No recent updates":"No hay novedades recientes","When your friends share a status, it will appear here.":"Los estados de tus amigos aparecerán aquí.","Recent updates":"Actualizaciones recientes","Your name":"Tu nombre","A little about you…":"Cuéntanos un poco sobre ti…","Required before opening your locked chats. Uses your device's passkey prompt.":"Necesario antes de abrir tus chats bloqueados. Usa la solicitud de clave de acceso de tu dispositivo.","Set up again":"Configurar de nuevo","Enable":"Activar","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"La autenticación biométrica o con clave de acceso no está disponible en este navegador. Prueba un navegador compatible en un dispositivo con bloqueo de pantalla.","Verification is configured on this device. Locked chats:":"La verificación está configurada en este dispositivo. Chats bloqueados:","Privacy preference for future profile discovery controls":"Preferencia de privacidad para futuras opciones de búsqueda de perfiles","Allow friends to see your last active time when presence is added":"Permitir que tus amigos vean tu última actividad cuando se añada la función de presencia","Saving language preference…":"Guardando preferencia de idioma…","Saving…":"Guardando…","Current app release":"Versión actual de la aplicación","CHAT LOCK":"BLOQUEO DE CHAT","Lock":"Bloquear","Unlock":"Desbloquear","Locked private chat":"Chat privado bloqueado","Locked group":"Grupo bloqueado","No locked chats yet.":"Aún no hay chats bloqueados.","CHATS":"CHATS","Back to chats":"Volver a los chats","Archive":"Archivar","Restore":"Restaurar","Chat Lock":"Bloqueo de chat","No archived chats.":"No hay chats archivados.","No chats yet. Search for someone in Friends and send your first message.":"Aún no hay chats. Busca a alguien en Amigos y envía tu primer mensaje."}undefined
  fr: {"Messages":"Messages","Status":"Statut","Friends":"Amis","Settings":"Paramètres","Your profile":"Votre profil","Appearance":"Apparence","Dark mode":"Mode sombre","Use a darker theme across ConnectX":"Utiliser un thème sombre dans ConnectX","Chat lock & security":"Verrouillage et sécurité du chat","Fingerprint / biometric verification":"Vérification par empreinte / biométrie","Privacy":"Confidentialité","Private profile":"Profil privé","Show last seen":"Afficher la dernière connexion","Profile photo":"Photo de profil","Display name":"Nom affiché","Username":"Nom d’utilisateur","Bio":"Bio","Save profile":"Enregistrer le profil","Sign out":"Se déconnecter","Change language":"Changer de langue","Choose your app language":"Choisissez la langue de l’application","Your space to connect":"Votre espace de connexion","Search friends":"Rechercher des amis","Search exact username (e.g. @samarth)":"Rechercher un nom d’utilisateur exact","Refresh":"Actualiser","Loading your account…":"Chargement de votre compte…","Updates":"Actualités","Share what’s happening":"Partagez ce qui se passe","My status":"Mon statut","Add":"Ajouter","No recent updates":"Aucune actualité récente","When your friends share a status, it will appear here.":"Les statuts de vos amis apparaîtront ici.","Recent updates":"Actualités récentes","Your name":"Votre nom","A little about you…":"Quelques mots sur vous…","Required before opening your locked chats. Uses your device's passkey prompt.":"Nécessaire avant d’ouvrir vos discussions verrouillées. Utilise la demande de clé d’accès de votre appareil.","Set up again":"Configurer à nouveau","Enable":"Activer","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"L’authentification biométrique ou par clé d’accès n’est pas disponible dans ce navigateur. Essayez un navigateur compatible sur un appareil avec verrouillage d’écran.","Verification is configured on this device. Locked chats:":"La vérification est configurée sur cet appareil. Discussions verrouillées :","Privacy preference for future profile discovery controls":"Préférence de confidentialité pour les futurs contrôles de découverte de profil","Allow friends to see your last active time when presence is added":"Autoriser vos amis à voir votre dernière activité lorsque la présence sera disponible","Saving language preference…":"Enregistrement de la langue…","Saving…":"Enregistrement…","Current app release":"Version actuelle de l’application","CHAT LOCK":"VERROUILLAGE DES CHATS","Lock":"Verrouiller","Unlock":"Déverrouiller","Locked private chat":"Discussion privée verrouillée","Locked group":"Groupe verrouillé","No locked chats yet.":"Aucune discussion verrouillée pour le moment.","CHATS":"DISCUSSIONS","Back to chats":"Retour aux discussions","Archive":"Archiver","Restore":"Restaurer","Chat Lock":"Verrouillage du chat","No archived chats.":"Aucune discussion archivée.","No chats yet. Search for someone in Friends and send your first message.":"Aucune discussion. Recherchez quelqu’un dans Amis et envoyez votre premier message."}undefined
  de: {"Messages":"Nachrichten","Status":"Status","Friends":"Freunde","Settings":"Einstellungen","Your profile":"Dein Profil","Appearance":"Darstellung","Dark mode":"Dunkelmodus","Use a darker theme across ConnectX":"Dunkles Design in ConnectX verwenden","Chat lock & security":"Chatsperre und Sicherheit","Fingerprint / biometric verification":"Fingerabdruck- / biometrische Prüfung","Privacy":"Datenschutz","Private profile":"Privates Profil","Show last seen":"Zuletzt online anzeigen","Profile photo":"Profilfoto","Display name":"Anzeigename","Username":"Benutzername","Bio":"Biografie","Save profile":"Profil speichern","Sign out":"Abmelden","Change language":"Sprache ändern","Choose your app language":"Wähle deine App-Sprache","Your space to connect":"Dein Ort zum Vernetzen","Search friends":"Freunde suchen","Search exact username (e.g. @samarth)":"Exakten Benutzernamen suchen","Refresh":"Aktualisieren","Loading your account…":"Konto wird geladen…","Updates":"Neuigkeiten","Share what’s happening":"Teile, was gerade passiert","My status":"Mein Status","Add":"Hinzufügen","No recent updates":"Keine neuen Neuigkeiten","When your friends share a status, it will appear here.":"Statusmeldungen deiner Freunde erscheinen hier.","Recent updates":"Neueste Updates","Your name":"Dein Name","A little about you…":"Ein paar Worte über dich…","Required before opening your locked chats. Uses your device's passkey prompt.":"Vor dem Öffnen gesperrter Chats erforderlich. Verwendet die Passkey-Abfrage deines Geräts.","Set up again":"Erneut einrichten","Enable":"Aktivieren","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"Biometrische Anmeldung oder Passkey ist in diesem Browser nicht verfügbar. Verwende einen unterstützten Browser auf einem Gerät mit Bildschirmsperre.","Verification is configured on this device. Locked chats:":"Die Bestätigung ist auf diesem Gerät eingerichtet. Gesperrte Chats:","Privacy preference for future profile discovery controls":"Datenschutzeinstellung für die künftige Profilsuche","Allow friends to see your last active time when presence is added":"Freunden die letzte Aktivität anzeigen, sobald die Präsenzfunktion verfügbar ist","Saving language preference…":"Spracheinstellung wird gespeichert…","Saving…":"Wird gespeichert…","Current app release":"Aktuelle App-Version","CHAT LOCK":"CHATSPERRE","Lock":"Sperren","Unlock":"Entsperren","Locked private chat":"Gesperrter privater Chat","Locked group":"Gesperrte Gruppe","No locked chats yet.":"Noch keine gesperrten Chats.","CHATS":"CHATS","Back to chats":"Zurück zu Chats","Archive":"Archivieren","Restore":"Wiederherstellen","Chat Lock":"Chatsperre","No archived chats.":"Keine archivierten Chats.","No chats yet. Search for someone in Friends and send your first message.":"Noch keine Chats. Suche unter Freunde nach jemandem und sende deine erste Nachricht."}undefined
  pt: {"Messages":"Mensagens","Status":"Status","Friends":"Amigos","Settings":"Configurações","Your profile":"Seu perfil","Appearance":"Aparência","Dark mode":"Modo escuro","Use a darker theme across ConnectX":"Usar tema escuro no ConnectX","Chat lock & security":"Bloqueio e segurança do chat","Fingerprint / biometric verification":"Verificação por impressão digital / biométrica","Privacy":"Privacidade","Private profile":"Perfil privado","Show last seen":"Mostrar último acesso","Profile photo":"Foto do perfil","Display name":"Nome de exibição","Username":"Nome de usuário","Bio":"Biografia","Save profile":"Salvar perfil","Sign out":"Sair","Change language":"Mudar idioma","Choose your app language":"Escolha o idioma do aplicativo","Your space to connect":"Seu espaço para se conectar","Search friends":"Buscar amigos","Search exact username (e.g. @samarth)":"Buscar nome de usuário exato","Refresh":"Atualizar","Loading your account…":"Carregando sua conta…","Updates":"Atualizações","Share what’s happening":"Compartilhe o que está acontecendo","My status":"Meu status","Add":"Adicionar","No recent updates":"Sem atualizações recentes","When your friends share a status, it will appear here.":"Os status dos seus amigos aparecerão aqui.","Recent updates":"Atualizações recentes","Your name":"Seu nome","A little about you…":"Conte um pouco sobre você…","Required before opening your locked chats. Uses your device's passkey prompt.":"Necessário antes de abrir conversas bloqueadas. Usa a solicitação de chave de acesso do seu dispositivo.","Set up again":"Configurar novamente","Enable":"Ativar","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"A autenticação biométrica ou por chave de acesso não está disponível neste navegador. Use um navegador compatível em um dispositivo com bloqueio de tela.","Verification is configured on this device. Locked chats:":"A verificação está configurada neste dispositivo. Conversas bloqueadas:","Privacy preference for future profile discovery controls":"Preferência de privacidade para futuras opções de descoberta de perfil","Allow friends to see your last active time when presence is added":"Permitir que amigos vejam sua última atividade quando o recurso de presença estiver disponível","Saving language preference…":"Salvando preferência de idioma…","Saving…":"Salvando…","Current app release":"Versão atual do aplicativo","CHAT LOCK":"BLOQUEIO DE CHAT","Lock":"Bloquear","Unlock":"Desbloquear","Locked private chat":"Conversa privada bloqueada","Locked group":"Grupo bloqueado","No locked chats yet.":"Ainda não há conversas bloqueadas.","CHATS":"CONVERSAS","Back to chats":"Voltar às conversas","Archive":"Arquivar","Restore":"Restaurar","Chat Lock":"Bloqueio de chat","No archived chats.":"Não há conversas arquivadas.","No chats yet. Search for someone in Friends and send your first message.":"Ainda não há conversas. Procure alguém em Amigos e envie sua primeira mensagem."}undefined
  ar: {"Messages":"الرسائل","Status":"الحالة","Friends":"الأصدقاء","Settings":"الإعدادات","Your profile":"ملفك الشخصي","Appearance":"المظهر","Dark mode":"الوضع الداكن","Use a darker theme across ConnectX":"استخدم مظهراً داكناً في ConnectX","Chat lock & security":"قفل الدردشة والأمان","Fingerprint / biometric verification":"التحقق بالبصمة / القياسات الحيوية","Privacy":"الخصوصية","Private profile":"ملف شخصي خاص","Show last seen":"إظهار آخر ظهور","Profile photo":"صورة الملف الشخصي","Display name":"اسم العرض","Username":"اسم المستخدم","Bio":"نبذة","Save profile":"حفظ الملف الشخصي","Sign out":"تسجيل الخروج","Change language":"تغيير اللغة","Choose your app language":"اختر لغة التطبيق","Your space to connect":"مساحتك للتواصل","Search friends":"ابحث عن الأصدقاء","Search exact username (e.g. @samarth)":"ابحث عن اسم المستخدم بدقة","Refresh":"تحديث","Loading your account…":"جارٍ تحميل حسابك…","Updates":"التحديثات","Share what’s happening":"شارك ما يحدث","My status":"حالتي","Add":"إضافة","No recent updates":"لا توجد تحديثات حديثة","When your friends share a status, it will appear here.":"ستظهر حالات أصدقائك هنا.","Recent updates":"آخر التحديثات","Your name":"اسمك","A little about you…":"اكتب نبذة قصيرة عنك…","Required before opening your locked chats. Uses your device's passkey prompt.":"مطلوب قبل فتح المحادثات المقفلة. يستخدم مطالبة مفتاح المرور على جهازك.","Set up again":"إعادة الإعداد","Enable":"تفعيل","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"المصادقة بالبصمة أو مفتاح المرور غير متاحة في هذا المتصفح. جرّب متصفحًا مدعومًا على جهاز مزوّد بقفل شاشة.","Verification is configured on this device. Locked chats:":"تم إعداد التحقق على هذا الجهاز. المحادثات المقفلة:","Privacy preference for future profile discovery controls":"إعداد الخصوصية لخيارات اكتشاف الملفات الشخصية مستقبلًا","Allow friends to see your last active time when presence is added":"السماح للأصدقاء برؤية آخر وقت نشاط لك عند إضافة ميزة الحضور","Saving language preference…":"جارٍ حفظ تفضيل اللغة…","Saving…":"جارٍ الحفظ…","Current app release":"إصدار التطبيق الحالي","CHAT LOCK":"قفل الدردشة","Lock":"قفل","Unlock":"إلغاء القفل","Locked private chat":"محادثة خاصة مقفلة","Locked group":"مجموعة مقفلة","No locked chats yet.":"لا توجد محادثات مقفلة بعد.","CHATS":"الدردشات","Back to chats":"العودة إلى الدردشات","Archive":"أرشفة","Restore":"استعادة","Chat Lock":"قفل الدردشة","No archived chats.":"لا توجد محادثات مؤرشفة.","No chats yet. Search for someone in Friends and send your first message.":"لا توجد محادثات بعد. ابحث عن شخص في الأصدقاء وأرسل رسالتك الأولى."}undefined
  id: {"Messages":"Pesan","Status":"Status","Friends":"Teman","Settings":"Pengaturan","Your profile":"Profil Anda","Appearance":"Tampilan","Dark mode":"Mode gelap","Use a darker theme across ConnectX":"Gunakan tema gelap di ConnectX","Chat lock & security":"Kunci chat & keamanan","Fingerprint / biometric verification":"Verifikasi sidik jari / biometrik","Privacy":"Privasi","Private profile":"Profil pribadi","Show last seen":"Tampilkan terakhir dilihat","Profile photo":"Foto profil","Display name":"Nama tampilan","Username":"Nama pengguna","Bio":"Bio","Save profile":"Simpan profil","Sign out":"Keluar","Change language":"Ubah bahasa","Choose your app language":"Pilih bahasa aplikasi","Your space to connect":"Ruang Anda untuk terhubung","Search friends":"Cari teman","Search exact username (e.g. @samarth)":"Cari nama pengguna yang tepat","Refresh":"Muat ulang","Loading your account…":"Memuat akun Anda…","Updates":"Pembaruan","Share what’s happening":"Bagikan apa yang terjadi","My status":"Status saya","Add":"Tambah","No recent updates":"Belum ada pembaruan terbaru","When your friends share a status, it will appear here.":"Status teman Anda akan muncul di sini.","Recent updates":"Pembaruan terbaru","Your name":"Nama Anda","A little about you…":"Ceritakan sedikit tentang diri Anda…","Required before opening your locked chats. Uses your device's passkey prompt.":"Diperlukan sebelum membuka chat terkunci. Menggunakan permintaan kunci sandi perangkat Anda.","Set up again":"Atur ulang","Enable":"Aktifkan","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"Autentikasi biometrik/kunci sandi tidak tersedia di browser ini. Coba browser yang didukung pada perangkat dengan kunci layar aktif.","Verification is configured on this device. Locked chats:":"Verifikasi telah disiapkan di perangkat ini. Chat terkunci:","Privacy preference for future profile discovery controls":"Preferensi privasi untuk fitur penemuan profil mendatang","Allow friends to see your last active time when presence is added":"Izinkan teman melihat waktu terakhir aktif saat fitur kehadiran tersedia","Saving language preference…":"Menyimpan preferensi bahasa…","Saving…":"Menyimpan…","Current app release":"Rilis aplikasi saat ini","CHAT LOCK":"KUNCI CHAT","Lock":"Kunci","Unlock":"Buka kunci","Locked private chat":"Chat pribadi terkunci","Locked group":"Grup terkunci","No locked chats yet.":"Belum ada chat terkunci.","CHATS":"CHAT","Back to chats":"Kembali ke chat","Archive":"Arsipkan","Restore":"Pulihkan","Chat Lock":"Kunci Chat","No archived chats.":"Tidak ada chat yang diarsipkan.","No chats yet. Search for someone in Friends and send your first message.":"Belum ada chat. Cari seseorang di Teman dan kirim pesan pertama Anda."}undefined
  ja: {"Messages":"メッセージ","Status":"ステータス","Friends":"友達","Settings":"設定","Your profile":"プロフィール","Appearance":"外観","Dark mode":"ダークモード","Use a darker theme across ConnectX":"ConnectX全体でダークテーマを使用","Chat lock & security":"チャットロックとセキュリティ","Fingerprint / biometric verification":"指紋認証 / 生体認証","Privacy":"プライバシー","Private profile":"非公開プロフィール","Show last seen":"最終ログインを表示","Profile photo":"プロフィール写真","Display name":"表示名","Username":"ユーザー名","Bio":"自己紹介","Save profile":"プロフィールを保存","Sign out":"ログアウト","Change language":"言語を変更","Choose your app language":"アプリの言語を選択","Your space to connect":"つながるためのスペース","Search friends":"友達を検索","Search exact username (e.g. @samarth)":"ユーザー名を正確に検索","Refresh":"更新","Loading your account…":"アカウントを読み込み中…","Updates":"最新情報","Share what’s happening":"近況をシェア","My status":"自分のステータス","Add":"追加","No recent updates":"最近の更新はありません","When your friends share a status, it will appear here.":"友達のステータスがここに表示されます。","Recent updates":"最近の更新","Your name":"名前","A little about you…":"自己紹介を入力してください…","Required before opening your locked chats. Uses your device's passkey prompt.":"ロックしたチャットを開く前に必要です。端末のパスキー認証を使用します。","Set up again":"再設定","Enable":"有効にする","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"このブラウザーでは生体認証／パスキー認証を利用できません。画面ロックを設定した端末で対応ブラウザーをお試しください。","Verification is configured on this device. Locked chats:":"この端末では認証が設定されています。ロック中のチャット:","Privacy preference for future profile discovery controls":"今後のプロフィール検索に関するプライバシー設定","Allow friends to see your last active time when presence is added":"プレゼンス機能の追加後、友達に最終アクティブ時刻を表示する","Saving language preference…":"言語設定を保存しています…","Saving…":"保存中…","Current app release":"現在のアプリリリース","CHAT LOCK":"チャットロック","Lock":"ロック","Unlock":"ロック解除","Locked private chat":"ロックされたプライベートチャット","Locked group":"ロックされたグループ","No locked chats yet.":"ロックされたチャットはありません。","CHATS":"チャット","Back to chats":"チャットに戻る","Archive":"アーカイブ","Restore":"復元","Chat Lock":"チャットロック","No archived chats.":"アーカイブ済みのチャットはありません。","No chats yet. Search for someone in Friends and send your first message.":"チャットはまだありません。友達から相手を検索して最初のメッセージを送りましょう。"}undefined
  ko: {"Messages":"메시지","Status":"상태","Friends":"친구","Settings":"설정","Your profile":"내 프로필","Appearance":"화면 설정","Dark mode":"다크 모드","Use a darker theme across ConnectX":"ConnectX 전체에 어두운 테마 사용","Chat lock & security":"채팅 잠금 및 보안","Fingerprint / biometric verification":"지문 / 생체 인증","Privacy":"개인정보 보호","Private profile":"비공개 프로필","Show last seen":"최근 접속 표시","Profile photo":"프로필 사진","Display name":"표시 이름","Username":"사용자 이름","Bio":"소개","Save profile":"프로필 저장","Sign out":"로그아웃","Change language":"언어 변경","Choose your app language":"앱 언어 선택","Your space to connect":"소통을 위한 공간","Search friends":"친구 검색","Search exact username (e.g. @samarth)":"정확한 사용자 이름 검색","Refresh":"새로고침","Loading your account…":"계정을 불러오는 중…","Updates":"업데이트","Share what’s happening":"근황 공유하기","My status":"내 상태","Add":"추가","No recent updates":"최근 업데이트가 없습니다","When your friends share a status, it will appear here.":"친구의 상태가 여기에 표시됩니다.","Recent updates":"최근 업데이트","Your name":"이름","A little about you…":"자기소개를 입력하세요…","Required before opening your locked chats. Uses your device's passkey prompt.":"잠긴 채팅을 열기 전에 필요합니다. 기기의 패스키 인증을 사용합니다.","Set up again":"다시 설정","Enable":"사용","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"이 브라우저에서는 생체 인식/패스키 인증을 사용할 수 없습니다. 화면 잠금이 설정된 기기에서 지원되는 브라우저를 사용하세요.","Verification is configured on this device. Locked chats:":"이 기기에 인증이 설정되었습니다. 잠긴 채팅:","Privacy preference for future profile discovery controls":"향후 프로필 검색을 위한 개인정보 설정","Allow friends to see your last active time when presence is added":"접속 상태 기능이 추가되면 친구에게 마지막 활동 시간을 표시합니다","Saving language preference…":"언어 설정 저장 중…","Saving…":"저장 중…","Current app release":"현재 앱 버전","CHAT LOCK":"채팅 잠금","Lock":"잠금","Unlock":"잠금 해제","Locked private chat":"잠긴 비공개 채팅","Locked group":"잠긴 그룹","No locked chats yet.":"잠긴 채팅이 없습니다.","CHATS":"채팅","Back to chats":"채팅으로 돌아가기","Archive":"보관","Restore":"복원","Chat Lock":"채팅 잠금","No archived chats.":"보관된 채팅이 없습니다.","No chats yet. Search for someone in Friends and send your first message.":"아직 채팅이 없습니다. 친구에서 상대를 검색하고 첫 메시지를 보내세요."}undefined
  zh: {"Messages":"消息","Status":"动态","Friends":"好友","Settings":"设置","Your profile":"个人资料","Appearance":"外观","Dark mode":"深色模式","Use a darker theme across ConnectX":"在 ConnectX 中使用深色主题","Chat lock & security":"聊天锁定与安全","Fingerprint / biometric verification":"指纹 / 生物识别验证","Privacy":"隐私","Private profile":"私人资料","Show last seen":"显示最后上线时间","Profile photo":"头像","Display name":"显示名称","Username":"用户名","Bio":"简介","Save profile":"保存资料","Sign out":"退出登录","Change language":"更改语言","Choose your app language":"选择应用语言","Your space to connect":"连接彼此的空间","Search friends":"搜索好友","Search exact username (e.g. @samarth)":"搜索准确的用户名","Refresh":"刷新","Loading your account…":"正在加载账户…","Updates":"动态","Share what’s happening":"分享近况","My status":"我的状态","Add":"添加","No recent updates":"暂无最新动态","When your friends share a status, it will appear here.":"好友分享的状态会显示在这里。","Recent updates":"最近更新","Your name":"你的姓名","A little about you…":"简单介绍一下自己…","Required before opening your locked chats. Uses your device's passkey prompt.":"打开已锁定的聊天前必须验证。使用设备的通行密钥提示。","Set up again":"重新设置","Enable":"启用","Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.":"此浏览器不支持生物识别/通行密钥验证。请在启用了屏幕锁定的设备上使用受支持的浏览器。","Verification is configured on this device. Locked chats:":"此设备已设置验证。已锁定的聊天：","Privacy preference for future profile discovery controls":"未来个人资料发现功能的隐私设置","Allow friends to see your last active time when presence is added":"添加在线状态功能后，允许好友查看你最后活跃的时间","Saving language preference…":"正在保存语言偏好…","Saving…":"正在保存…","Current app release":"当前应用版本","CHAT LOCK":"聊天锁定","Lock":"锁定","Unlock":"解锁","Locked private chat":"已锁定的私人聊天","Locked group":"已锁定的群组","No locked chats yet.":"暂无已锁定的聊天。","CHATS":"聊天","Back to chats":"返回聊天","Archive":"归档","Restore":"恢复","Chat Lock":"聊天锁定","No archived chats.":"没有已归档的聊天。","No chats yet. Search for someone in Friends and send your first message.":"暂无聊天。请在好友中搜索联系人并发送第一条消息。"}undefined
};

export default function ChatPreview() {
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [appLanguage, setAppLanguage] = useState("en");
  const [languageSaving, setLanguageSaving] = useState(false);
  const APP_NAV_COPY: Record<string, Record<string,string>> = {
en:{},
hi:{"Home":"होम","Friends":"दोस्त","Settings":"सेटिंग्स"},
mr:{"Home":"मुख्यपृष्ठ","Friends":"मित्र","Settings":"सेटिंग्ज"},
gu:{"Home":"હોમ","Friends":"મિત્રો","Settings":"સેટિંગ્સ"},
bn:{"Home":"হোম","Friends":"বন্ধুরা","Settings":"সেটিংস"},
ta:{"Home":"முகப்பு","Friends":"நண்பர்கள்","Settings":"அமைப்புகள்"},
te:{"Home":"హోమ్","Friends":"స్నేహితులు","Settings":"సెట్టింగ్‌లు"},
kn:{"Home":"ಮುಖಪುಟ","Friends":"ಸ್ನೇಹಿತರು","Settings":"ಸೆಟ್ಟಿಂಗ್‌ಗಳು"},
ml:{"Home":"ഹോം","Friends":"സുഹൃത്തുക്കൾ","Settings":"ക്രമീകരണങ്ങൾ"},
pa:{"Home":"ਮੁੱਖ ਪੰਨਾ","Friends":"ਦੋਸਤ","Settings":"ਸੈਟਿੰਗਾਂ"},
ur:{"Home":"ہوم","Friends":"دوست","Settings":"ترتیبات"},
es:{"Home":"Inicio","Friends":"Amigos","Settings":"Ajustes"},
fr:{"Home":"Accueil","Friends":"Amis","Settings":"Paramètres"},
de:{"Home":"Startseite","Friends":"Freunde","Settings":"Einstellungen"},
pt:{"Home":"Início","Friends":"Amigos","Settings":"Configurações"},
ar:{"Home":"الرئيسية","Friends":"الأصدقاء","Settings":"الإعدادات"},
id:{"Home":"Beranda","Friends":"Teman","Settings":"Pengaturan"},
ja:{"Home":"ホーム","Friends":"友達","Settings":"設定"},
ko:{"Home":"홈","Friends":"친구","Settings":"설정"},
zh:{"Home":"主页","Friends":"好友","Settings":"设置"}
};
const tr = (key: string) => APP_NAV_COPY[appLanguage]?.[key] || APP_COPY[appLanguage]?.[key] || APP_COPY.en?.[key] || key;

  // Keep document language and text direction in sync with the selected app language.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = appLanguage;
    document.documentElement.dir = appLanguage === "ar" || appLanguage === "ur" ? "rtl" : "ltr";
  }, [appLanguage]);
  const changeAppLanguage = async (next: string) => {
    setAppLanguage(next);
    try { localStorage.setItem("connectx-language", next); } catch {}
    setLanguageSaving(true);
    try { const { error } = await supabase.auth.updateUser({ data: { preferred_language: next } }); if (error) throw error; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save language preference."); }
    finally { setLanguageSaving(false); }
  };

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
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesLoadAttempted, setProfilesLoadAttempted] = useState(false);
  const [profilesLoadError, setProfilesLoadError] = useState("");
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestSendingProfileId, setRequestSendingProfileId] = useState<string | null>(null);
  const [pendingRequestProfileIds, setPendingRequestProfileIds] = useState<string[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [typing, setTyping] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [editMessageBusy, setEditMessageBusy] = useState(false);
  const [editingGroupMessageId, setEditingGroupMessageId] = useState<string | null>(null);
  const [editGroupMessageDraft, setEditGroupMessageDraft] = useState("");
  const [editGroupMessageBusy, setEditGroupMessageBusy] = useState(false);
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [chatPreferences, setChatPreferences] = useState<ChatPreference[]>([]);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [chatActionMenuId, setChatActionMenuId] = useState<string | null>(null);
  const [chatLockIds, setChatLockIds] = useState<string[]>([]);
  const [chatLockCredential, setChatLockCredential] = useState<string | null>(null);
  const [chatLockUnlocked, setChatLockUnlocked] = useState(false);
  const [chatLockSupported, setChatLockSupported] = useState(false);
  const [chatLockBusy, setChatLockBusy] = useState(false);
  const [showLockedChats, setShowLockedChats] = useState(false);
  useEffect(() => {
    try {
      setChatLockIds(JSON.parse(localStorage.getItem("connectx-chat-locks-" + userId) || "[]"));
      setChatLockCredential(localStorage.getItem("connectx-chat-lock-credential-" + userId));
      setChatLockSupported(typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials);
    } catch { setChatLockIds([]); setChatLockCredential(null); }
  }, [userId]);

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
  const [blockedWithSelected, setBlockedWithSelected] = useState(false);
  const [blockActionBusy, setBlockActionBusy] = useState(false);
  const [disappearingHours, setDisappearingHours] = useState(0);
  const [disappearingBusy, setDisappearingBusy] = useState(false);
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
    setDisappearingHours(0);
    try {
      const [firstUser, secondUser] = [userId, selectedFriend.id].sort();
      const { data: disappearingSetting, error: disappearingError } = await supabase.from("chat_disappearing_settings").select("duration_hours").eq("user_one", firstUser).eq("user_two", secondUser).maybeSingle();
      if (disappearingError) throw disappearingError;
      setDisappearingHours(disappearingSetting?.duration_hours ?? 0);
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
  const [groupAvatarBusy, setGroupAvatarBusy] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showGroupTools, setShowGroupTools] = useState(false);
  const [groupChatMenuOpen, setGroupChatMenuOpen] = useState(false);
  const [groupSelectionMode, setGroupSelectionMode] = useState(false);
  const [selectedGroupMessageIds, setSelectedGroupMessageIds] = useState<string[]>([]);
  const [groupFeedSelectionMode, setGroupFeedSelectionMode] = useState(false);
  const [selectedGroupFeedItems, setSelectedGroupFeedItems] = useState<string[]>([]);
  const [groupToolTab, setGroupToolTab] = useState<"announcement"|"poll"|null>(null);
  const [groupMembers, setGroupMembers] = useState<Array<{user_id:string;role:string;joined_at:string}>>([]);
  const [groupAnnouncements, setGroupAnnouncements] = useState<Array<{id:string;author_id:string;content:string;created_at:string}>>([]);
  const [groupPolls, setGroupPolls] = useState<Array<{id:string;created_by:string;question:string;is_closed:boolean;allow_multiple_answers:boolean;hide_voter_names:boolean;created_at:string;options:Array<{id:string;label:string;votes:number;voted:boolean}>}>>([]);
  const [expandedGroupPolls, setExpandedGroupPolls] = useState<string[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsDraft, setPollOptionsDraft] = useState<string[]>(["", ""]);
  const [pollAllowMultipleAnswers, setPollAllowMultipleAnswers] = useState(false);
  const [pollHideVoterNames, setPollHideVoterNames] = useState(false);
  const groupPostLock = useRef(false);
  const [groupPostBusy, setGroupPostBusy] = useState(false);
  const groupVoteLock = useRef(new Set<string>());
  const [groupVoteBusyIds, setGroupVoteBusyIds] = useState<string[]>([]);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditDescription, setGroupEditDescription] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; content: string; sender_id: string; kind: "direct" | "group" } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const messageLoadRequestRef = useRef(0);
  const groupMessageLoadRequestRef = useRef(0);
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
    groupMessageLoadRequestRef.current += 1;
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
  const [recordingLocked,setRecordingLocked]=useState(false);
  const [recordingSeconds,setRecordingSeconds]=useState(0);
  const voiceGestureRef=useRef<{x:number;y:number}|null>(null);
  const voiceLockedRef=useRef(false);
  const voiceCancelRef=useRef(false);
  const voiceAutoSendRef=useRef(false);
  const stopAfterStartRef=useRef(false);
  const [voiceBlob,setVoiceBlob]=useState<Blob|null>(null);
  const [voicePreview,setVoicePreview]=useState("");
  useEffect(()=>{if(!recording)return;const started=Date.now();const timer=window.setInterval(()=>setRecordingSeconds(Math.floor((Date.now()-started)/1000)),250);return()=>window.clearInterval(timer);},[recording]);
  const recorderRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const statusInputRef=useRef<HTMLInputElement|null>(null);
  const [search, setSearch] = useState("");
  const [usernameSearchProfile, setUsernameSearchProfile] = useState<Profile | null>(null);
  const [usernameSearchLoading, setUsernameSearchLoading] = useState(false);
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
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [intelligenceInput, setIntelligenceInput] = useState("");
  const [intelligenceBusy, setIntelligenceBusy] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState("");
  const [intelligenceTurns, setIntelligenceTurns] = useState<Array<{id:string;role:"user"|"assistant";content:string}>>([]);
  const [intelligenceUseContext, setIntelligenceUseContext] = useState(true);
  const intelligenceScrollRef = useRef<HTMLDivElement|null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callMode, setCallMode] = useState<"audio" | "video">("audio");
  const [callStatus, setCallStatus] = useState("");
  const [callFeedback, setCallFeedback] = useState("");
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
    const [profileResult, requestResult] = await Promise.all([
      supabase.from("profiles").select("id,username,full_name,avatar_url,bio,is_private,show_last_seen").eq("id", id).maybeSingle(),
      supabase.from("friend_requests").select("id,sender_id,receiver_id,status,created_at")
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`).order("created_at", { ascending: false }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (requestResult.error) throw requestResult.error;
    setMyProfile(profileResult.data);
    if (profileResult.data) {
      setProfileName(profileResult.data.full_name ?? "");
      setProfileUsername(profileResult.data.username ?? "");
      setProfileBio(profileResult.data.bio ?? "");
      setProfilePrivate(!!profileResult.data.is_private);
      setShowLastSeen(profileResult.data.show_last_seen !== false);
    }
    setRequests((requestResult.data ?? []) as FriendRequest[]);
  }, []);

  const loadPublicProfiles = useCallback(async () => {
    if (!userId || profilesLoading || profilesLoaded || profilesLoadAttempted) return;
    setProfilesLoadAttempted(true);
    setProfilesLoadError("");
    setProfilesLoading(true);
    try {
      const acceptedFriendIds = Array.from(new Set(requests
        .filter((request) => request.status === "accepted")
        .map((request) => request.sender_id === userId ? request.receiver_id : request.sender_id)
        .filter((id) => id !== userId)));
      const [publicResult, acceptedResult] = await Promise.all([
        supabase.from("profiles").select("id,username,full_name,avatar_url,is_private")
          .eq("is_private", false).neq("id", userId).order("full_name").limit(100),
        acceptedFriendIds.length
          ? supabase.from("profiles").select("id,username,full_name,avatar_url,is_private").in("id", acceptedFriendIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (publicResult.error) throw publicResult.error;
      if (acceptedResult.error) throw acceptedResult.error;
      const merged = new Map<string, Profile>();
      for (const profile of [...(publicResult.data ?? []), ...(acceptedResult.data ?? [])] as Profile[]) merged.set(profile.id, profile);
      setProfiles(Array.from(merged.values()));
      setProfilesLoaded(true);
    } catch (reason) {
      setProfilesLoadError(reason instanceof Error ? reason.message : "Could not load people.");
      throw reason;
    } finally {
      setProfilesLoading(false);
    }
  }, [userId, requests, profilesLoading, profilesLoaded, profilesLoadAttempted]);

  useEffect(() => {
    if (tab !== "Friends") {
      setUsernameSearchProfile(null);
      setUsernameSearchLoading(false);
    }
  }, [tab]);
  const refreshRequests = useCallback(async () => {
    if (!userId) return;
    const { data, error: requestError } = await supabase.from("friend_requests")
      .select("id,sender_id,receiver_id,status,created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (requestError) throw requestError;
    setRequests((data ?? []) as FriendRequest[]);
    setProfilesLoaded(false);
    setProfilesLoadAttempted(false);
  }, [userId]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (!active) return;
      if (authError) throw authError;
      if (!data.user) {
        setError("Your signup is not complete yet. Please sign in again.");
        setLoading(false);
        window.location.replace("/");
        return;
      }
      setUserId(data.user.id);
      const savedLanguage = String(data.user.user_metadata?.preferred_language || "");
      if (APP_LANGUAGES.some(([code]) => code === savedLanguage)) setAppLanguage(savedLanguage);
      else { try { const localLanguage = localStorage.getItem("connectx-language") || "en"; if (APP_LANGUAGES.some(([code]) => code === localLanguage)) setAppLanguage(localLanguage); } catch {} }
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
    () => profiles.filter((profile) => acceptedIds.has(profile.id) && !chatLockIds.includes("friend:" + profile.id) && !chatPreferences.find((pref) => pref.friend_id === profile.id)?.hidden_at && !chatPreferences.find((pref) => pref.friend_id === profile.id)?.is_archived)
      .sort((a, b) => Number(!!chatPreferences.find((pref) => pref.friend_id === b.id)?.is_pinned) - Number(!!chatPreferences.find((pref) => pref.friend_id === a.id)?.is_pinned)),
    [profiles, acceptedIds, chatPreferences, chatLockIds],
  );
  const archivedFriends = useMemo(
    () => profiles.filter((profile) => acceptedIds.has(profile.id) && !!chatPreferences.find((pref) => pref.friend_id === profile.id)?.is_archived),
    [profiles, acceptedIds, chatPreferences],
  );
  const recentChatById = useMemo(
    () => new Map(recentChats.map((chat) => [chat.profile.id, chat])),
    [recentChats],
  );
  const homeChats = useMemo(() => {
    if (showArchivedChats) return archivedFriends;
    const unique = new Map<string, Profile>();
    friends.forEach((friend) => unique.set(friend.id, friend));
    recentChats.forEach((chat) => unique.set(chat.profile.id, chat.profile));
    return Array.from(unique.values()).sort((a, b) => {
      const aPinned = !!chatPreferences.find((pref) => pref.friend_id === a.id)?.is_pinned;
      const bPinned = !!chatPreferences.find((pref) => pref.friend_id === b.id)?.is_pinned;
      if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
      const aTime = recentChatById.get(a.id)?.lastMessageAt ?? "";
      const bTime = recentChatById.get(b.id)?.lastMessageAt ?? "";
      return bTime.localeCompare(aTime);
    });
  }, [showArchivedChats, archivedFriends, friends, recentChats, recentChatById, chatPreferences]);
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
  useEffect(() => {
    if (tab !== "Friends") { setUsernameSearchProfile(null); return; }
    const username = search.trim().replace(/^@/, "").toLowerCase();
    if (!username) { setUsernameSearchProfile(null); setUsernameSearchLoading(false); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setUsernameSearchProfile(null); setUsernameSearchLoading(false); return; }
    let active = true;
    setUsernameSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: searchError } = await supabase.from("profiles")
          .select("id,username,full_name,avatar_url,bio,is_private,show_last_seen")
          .eq("username", username).maybeSingle();
        if (searchError) throw searchError;
        if (active) setUsernameSearchProfile(data as Profile | null);
      } catch (reason) {
        if (active) { setUsernameSearchProfile(null); setError(reason instanceof Error ? reason.message : "Could not search this username."); }
      } finally {
        if (active) setUsernameSearchLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [tab, search, userId]);
  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    if (!q || !usernameSearchProfile) return [];
    const visible = !acceptedIds.has(usernameSearchProfile.id) && !chatLockIds.includes("friend:" + usernameSearchProfile.id);
    return visible && (usernameSearchProfile.username ?? "").toLowerCase() === q ? [usernameSearchProfile] : [];
  }, [search, usernameSearchProfile, acceptedIds, chatLockIds]);


  const loadGroups = useCallback(async () => {
    if (!userId) return;
    const { data: memberships, error: membershipError } = await supabase.from("chat_group_members").select("group_id,role").eq("user_id", userId);
    if (membershipError) throw membershipError;
    const roleByGroup = new Map((memberships ?? []).map((row) => [row.group_id as string, row.role as string]));
    const ids = Array.from(roleByGroup.keys());
    if (!ids.length) { setGroups([]); return; }
    const { data, error } = await supabase.from("chat_groups").select("id,name,description,avatar_url,created_by,created_at").in("id", ids).order("created_at", { ascending: false });
    if (error) throw error;
    setGroups((data ?? []).map((group) => ({ ...group, my_role: roleByGroup.get(group.id) })) as ChatGroup[]);
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
      groupMessageLoadRequestRef.current += 1;
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

  async function uploadGroupAvatar(file: File) {
    if (!selectedGroup || !userId || groupAvatarBusy) return;
    if (!groupMembers.some(member => member.user_id === userId && member.role === "admin")) {
      setError("Only group admins can change the group photo."); return;
    }
    if (!file.type.startsWith("image/")) { setError("Choose an image file for the group photo."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Group photos must be 5 MB or smaller."); return; }
    setGroupAvatarBusy(true); setError(""); setNotice("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = userId + "/groups/" + selectedGroup.id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("connectx-avatars").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("connectx-avatars").getPublicUrl(path);
      const { data, error } = await supabase.from("chat_groups").update({ avatar_url: publicData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", selectedGroup.id).select("id,name,description,avatar_url,created_by,created_at").single();
      if (error) throw error;
      setSelectedGroup({ ...data, my_role: "admin" } as ChatGroup);
      setGroups(current => current.map(group => group.id === selectedGroup.id ? { ...group, avatar_url: publicData.publicUrl } : group));
      setNotice("Group photo updated.");
      await loadGroups();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the group photo.");
    } finally {
      setGroupAvatarBusy(false);
      if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = "";
    }
  }

  async function loadGroupFeed(group: ChatGroup) {
    const announcementsResult = await supabase.from("group_announcements").select("id,author_id,content,created_at").eq("group_id",group.id).order("created_at",{ascending:false}).limit(50);
    if(announcementsResult.error) throw announcementsResult.error;
    setGroupAnnouncements((announcementsResult.data??[]) as Array<{id:string;author_id:string;content:string;created_at:string}>);
    const pollsResult = await supabase.from("group_polls").select("id,created_by,question,is_closed,allow_multiple_answers,hide_voter_names,created_at").eq("group_id",group.id).order("created_at",{ascending:false}).limit(30);
    if(pollsResult.error) throw pollsResult.error;
    const rows=(pollsResult.data??[]) as Array<{id:string;created_by:string;question:string;is_closed:boolean;allow_multiple_answers:boolean;hide_voter_names:boolean;created_at:string}>;
    if(!rows.length){setGroupPolls([]);return;}
    const ids=rows.map(p=>p.id);
    const [optionsResult, voteResultsResult] = await Promise.all([
      supabase.from("group_poll_options").select("id,poll_id,label").in("poll_id",ids),
      supabase.rpc("connectx_group_poll_results", { p_group_id: group.id, p_poll_ids: ids }),
    ]);
    if(optionsResult.error) throw optionsResult.error;
    if(voteResultsResult.error) throw voteResultsResult.error;

    // The database returns aggregate counts and this user's vote state only;
    // voter identities never leave the protected votes table.
    const voteResultRows = (voteResultsResult.data ?? []) as Array<{
      poll_id: string;
      option_id: string;
      vote_count: number | string;
      voted_by_me: boolean;
    }>;
    const voteCounts = new Map<string, number>();
    const ownVoteKeys = new Set<string>();
    for (const vote of voteResultRows) {
      voteCounts.set(vote.option_id, Number(vote.vote_count));
      if (vote.voted_by_me) ownVoteKeys.add(`${vote.poll_id}:${vote.option_id}`);
    }
    const optionsByPoll = new Map<string, NonNullable<typeof optionsResult.data>>();
    for (const option of optionsResult.data ?? []) {
      const pollOptions = optionsByPoll.get(option.poll_id) ?? [];
      pollOptions.push(option);
      optionsByPoll.set(option.poll_id, pollOptions);
    }
    setGroupPolls(rows.map(p => ({
      ...p,
      options: (optionsByPoll.get(p.id) ?? []).map(option => ({
        id: option.id,
        label: option.label,
        votes: voteCounts.get(option.id) ?? 0,
        voted: ownVoteKeys.has(`${p.id}:${option.id}`),
      })),
    })));
  }
  async function openGroupProfile(){if(!selectedGroup)return;setGroupProfileOpen(true);try{await loadGroupProfile(selectedGroup);}catch(e){setError(e instanceof Error?e.message:"Could not load group info.");}}
  async function saveGroupDetails(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selectedGroup||!groupEditName.trim())return;const {data,error}=await supabase.from("chat_groups").update({name:groupEditName.trim(),description:groupEditDescription.trim()||null,updated_at:new Date().toISOString()}).eq("id",selectedGroup.id).select("id,name,description,created_by,created_at").single();if(error){setError(error.message);return;}setSelectedGroup(data as ChatGroup);await loadGroups();setNotice("Group info updated.");}
  async function postGroupAnnouncement(){
     const content=announcementDraft.trim();
     if(!selectedGroup||!userId||!content||groupPostLock.current)return;
     const myMembership=groupMembers.find(m=>m.user_id===userId);
     if(myMembership?.role!=="admin"){setError("Only group admins can post announcements.");return;}
     groupPostLock.current=true;setGroupPostBusy(true);setError("");setNotice("");
     try{
       const {data,error}=await supabase.from("group_announcements").insert({group_id:selectedGroup.id,author_id:userId,content}).select("id,author_id,content,created_at").single();
       if(error)throw error;
       setGroupAnnouncements(current=>[data as {id:string;author_id:string;content:string;created_at:string},...current]);
       setAnnouncementDraft("");setGroupToolTab(null);setShowGroupTools(false);
       setNotice("Announcement posted.");
     }catch(e){setError(e instanceof Error?e.message:"Announcement could not be posted.");}
     finally{groupPostLock.current=false;setGroupPostBusy(false);}
   }
   async function createGroupPoll(){
     const question=pollQuestion.trim();
     const opts=pollOptionsDraft.map(x=>x.trim()).filter(Boolean).slice(0,10);
     if(!selectedGroup||!userId||!question||groupPostLock.current)return;
     if(opts.length<2){setError("Add at least two non-empty options.");return;}
     groupPostLock.current=true;setGroupPostBusy(true);setError("");setNotice("");
     try{
       const {data,error}=await supabase.rpc("create_group_poll",{
         p_group_id:selectedGroup.id,p_question:question,p_options:opts,
         p_allow_multiple_answers:pollAllowMultipleAnswers,p_hide_voter_names:pollHideVoterNames
       });
       if(error)throw error;
       if(!data)throw new Error("The poll was not saved. Please try again.");

       // The poll is committed at this point. A follow-up feed refresh can fail
       // independently, so never tell the user that creation failed or leave
       // the composer ready to submit a duplicate poll.
       setPollQuestion("");setPollOptionsDraft(["",""]);setPollAllowMultipleAnswers(false);setPollHideVoterNames(false);
       setGroupToolTab(null);setShowGroupTools(false);
       try {
         await loadGroupFeed(selectedGroup);
         setNotice("Poll posted.");
       } catch {
         setNotice("Poll posted, but the group feed could not refresh. Reopen the group to see it.");
       }
     }catch(e){setError(e instanceof Error?e.message:"Poll could not be posted.");}
     finally{groupPostLock.current=false;setGroupPostBusy(false);}
   }
   async function deleteGroupPoll(pollId:string){
     if(!selectedGroup||!userId)return;
     const poll=groupPolls.find(item=>item.id===pollId);
     if(!poll)return;
     const isAdmin=groupMembers.some(member=>member.user_id===userId&&member.role==="admin");
     if(poll.created_by!==userId&&!isAdmin){setNotice("Only the poll creator or a group admin can delete this poll.");return;}
     if(!window.confirm("Delete this poll and all its votes? This cannot be undone."))return;
     const {data,error}=await supabase.rpc("connectx_delete_group_poll",{p_poll_id:pollId});
     if(error){setError("Poll could not be deleted: "+error.message);return;}
     if(data!==true){setError("Poll was not found or was already deleted. Refresh the group and try again.");return;}
     setGroupPolls(current=>current.filter(item=>item.id!==pollId));
     setExpandedGroupPolls(current=>current.filter(id=>id!==pollId));
     setNotice("Poll deleted.");
   }
   async function deleteSelectedGroupFeedItems(){
     if(!selectedGroup||!userId||!selectedGroupFeedItems.length)return;
     const isAdmin=groupMembers.some(member=>member.user_id===userId&&member.role==="admin");
     const announcementIds=selectedGroupFeedItems.filter(key=>key.startsWith("announcement:")).map(key=>key.slice("announcement:".length));
     const pollIds=selectedGroupFeedItems.filter(key=>key.startsWith("poll:")).map(key=>key.slice("poll:".length));
     const allowedAnnouncements=announcementIds.filter(id=>{const item=groupAnnouncements.find(a=>a.id===id);return item&&(item.author_id===userId||isAdmin);});
     const allowedPolls=pollIds.filter(id=>{const item=groupPolls.find(p=>p.id===id);return item&&(item.created_by===userId||isAdmin);});
     const denied=selectedGroupFeedItems.length-allowedAnnouncements.length-allowedPolls.length;
     if(!allowedAnnouncements.length&&!allowedPolls.length){setNotice("You can delete your own announcements and polls. Group admins can delete all group posts.");return;}
     const count=allowedAnnouncements.length+allowedPolls.length;
     if(!window.confirm("Delete "+count+" selected post(s)? This cannot be undone."))return;
     try{
       if(allowedAnnouncements.length){
         const {data,error}=await supabase.from("group_announcements").delete().in("id",allowedAnnouncements).select("id");
         if(error)throw error;
         const deleted=new Set((data??[]).map((row:{id:string})=>row.id));
         setGroupAnnouncements(old=>old.filter(a=>!deleted.has(a.id)));
         if(deleted.size!==allowedAnnouncements.length)throw new Error("Some announcements were not deleted. Check that you are the author or a group admin.");
       }
       for(const pollId of allowedPolls){
         const {data,error}=await supabase.rpc("connectx_delete_group_poll",{p_poll_id:pollId});
         if(error)throw error;
         if(data!==true)throw new Error("A poll could not be deleted. Refresh the group and try again.");
         setGroupPolls(old=>old.filter(p=>p.id!==pollId));
         setExpandedGroupPolls(old=>old.filter(id=>id!==pollId));
       }
       setSelectedGroupFeedItems([]);setGroupFeedSelectionMode(false);
       setNotice(count+" post(s) deleted."+(denied?" "+denied+" item(s) skipped because you do not have permission.":""));
     }catch(e){
       setError("Could not delete all selected posts: "+(e instanceof Error?e.message:"Unknown error"));
       await loadGroupFeed(selectedGroup);
     }
   }
   async function voteGroupPoll(pollId:string,optionId:string){
     const group=selectedGroup;
     const p=groupPolls.find(x=>x.id===pollId);
     if(!group||!p||p.is_closed||!userId||groupVoteLock.current.has(pollId))return;
     const selected=p.options.find(x=>x.id===optionId);
     if(!selected)return;

     groupVoteLock.current.add(pollId);
     setGroupVoteBusyIds(current=>current.includes(pollId)?current:[...current,pollId]);
     setError("");setNotice("");
     try{
       let result;
       if(p.allow_multiple_answers){
         result=selected.voted
           ? await supabase.from("group_poll_votes").delete().eq("poll_id",pollId).eq("option_id",optionId).eq("user_id",userId)
           : await supabase.from("group_poll_votes").insert({poll_id:pollId,option_id:optionId,user_id:userId});
       }else{
         const previous=p.options.find(x=>x.voted);
         result=previous
           ? await supabase.from("group_poll_votes").update({option_id:optionId}).eq("poll_id",pollId).eq("user_id",userId)
           : await supabase.from("group_poll_votes").insert({poll_id:pollId,option_id:optionId,user_id:userId});
       }
       if(result.error)throw result.error;

       // Keep the UI consistent with the committed vote if the follow-up read fails.
       const previous=p.options.find(x=>x.voted);
       setGroupPolls(current=>current.map(poll=>poll.id!==pollId?poll:{
         ...poll,
         options:poll.options.map(option=>{
           if(p.allow_multiple_answers&&option.id===optionId){
             return {...option,voted:!selected.voted,votes:Math.max(0,option.votes+(selected.voted?-1:1))};
           }
           if(!p.allow_multiple_answers&&option.id===optionId){
             return {...option,voted:true,votes:option.votes+(previous?.id===optionId?0:1)};
           }
           if(!p.allow_multiple_answers&&previous?.id===option.id){
             return {...option,voted:false,votes:Math.max(0,option.votes-1)};
           }
           return option;
         }),
       }));

       try{
         await loadGroupFeed(group);
       }catch{
         setNotice("Your vote was saved, but the poll results could not refresh. Reopen the group to see the latest totals.");
       }
     }catch(e){
       setError(e instanceof Error?e.message:"Your vote could not be saved.");
     }finally{
       groupVoteLock.current.delete(pollId);
       setGroupVoteBusyIds(current=>current.filter(id=>id!==pollId));
     }
   }
   async function manageGroupMember(memberId:string,action:"admin"|"member"|"remove"){if(!selectedGroup)return;const query=action==="remove"?supabase.from("chat_group_members").delete().eq("group_id",selectedGroup.id).eq("user_id",memberId):supabase.from("chat_group_members").update({role:action}).eq("group_id",selectedGroup.id).eq("user_id",memberId);const {error}=await query;if(error){setError(error.message);return;}await loadGroupProfile(selectedGroup);await loadGroups();}
  async function openGroup(group: ChatGroup) {
    const requestId = ++groupMessageLoadRequestRef.current;
    setSelectedGroup(group); setSelectedFriend(null); setShowMobileChat(true); setTab("Messages"); setError("");
    setGroupMessages([]);
    const { data, error } = await supabase.from("chat_group_messages").select("id,group_id,sender_id,content,created_at,edited_at,deleted_for_everyone,reply_to_id,reply_to_content,reply_to_sender_id").eq("group_id", group.id).order("created_at", { ascending: false }).limit(100);
    if (requestId !== groupMessageLoadRequestRef.current) return;
    if (error) { setError(error.message); return; }
    setGroupMessages(((data ?? []) as GroupMessage[]).reverse());
    try {
      await loadGroupProfile(group);
    } catch (e) {
      if (requestId === groupMessageLoadRequestRef.current) {
        setError(e instanceof Error ? e.message : "Could not load group extras.");
      }
    }
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
    const group = selectedGroup;
    const requestId = groupMessageLoadRequestRef.current;
    if (!content || !group || !userId || busy) return;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const reply = replyTarget?.kind === "group" ? replyTarget : null;
    const optimistic: GroupMessage = {
      id: optimisticId,
      group_id: group.id,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_for_everyone: false,
      reply_to_id: reply?.id ?? null,
      reply_to_content: reply?.content ?? null,
      reply_to_sender_id: reply?.sender_id ?? null,
    };
    setGroupMessages((old) => [...old, optimistic]);
    setGroupDraft("");
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.from("chat_group_messages").insert({
        group_id: group.id,
        sender_id: userId,
        content,
        reply_to_id: reply?.id ?? null,
        reply_to_content: reply?.content ?? null,
        reply_to_sender_id: reply?.sender_id ?? null,
      }).select("id,group_id,sender_id,content,created_at,edited_at,deleted_for_everyone,reply_to_id,reply_to_content,reply_to_sender_id").single();
      if (error) throw error;
      if (requestId !== groupMessageLoadRequestRef.current) return;
      if (!data) throw new Error("Message was not saved. Please try again.");
      const saved = data as GroupMessage;
      setGroupMessages((old) => {
        const withoutOptimistic = old.filter((item) => item.id !== optimisticId);
        return withoutOptimistic.some((item) => item.id === saved.id)
          ? withoutOptimistic.map((item) => item.id === saved.id ? saved : item)
          : [...withoutOptimistic, saved];
      });
      setReplyTarget(null);
    } catch (e) {
      if (requestId === groupMessageLoadRequestRef.current) {
        setGroupMessages((old) => old.filter((item) => item.id !== optimisticId));
        setGroupDraft(content);
        setError(e instanceof Error ? e.message : "Could not send group message.");
      }
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!selectedGroup || !userId) return;
    let active = true;
    const channel = supabase.channel("group-messages-" + selectedGroup.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_group_messages", filter: "group_id=eq." + selectedGroup.id }, (payload) => {
        if (!active) return;
        const row = payload.new as GroupMessage;
        setGroupMessages((old) => old.some((item) => item.id === row.id) ? old : [...old, row]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_group_messages", filter: "group_id=eq." + selectedGroup.id }, (payload) => {
        if (!active) return;
        const row = payload.new as GroupMessage;
        setGroupMessages((old) => old.map((item) => item.id === row.id ? { ...item, content: row.content, edited_at: row.edited_at } : item));
      }).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
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

  const loadRecentChats = useCallback(async () => {
    if (!userId) return;
    const { data, error: messageError } = await supabase.from("messages")
      .select("sender_id,receiver_id,content,created_at,message_type")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false }).limit(500);
    if (messageError) throw messageError;

    const latestByContact = new Map<string, { preview: string; created_at: string }>();
    for (const row of data ?? []) {
      const contactId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      if (!contactId || contactId === userId || latestByContact.has(contactId)) continue;
      const preference = chatPreferences.find((item) => item.friend_id === contactId);
      if (preference?.hidden_at || preference?.is_archived) continue;
      if (preference?.cleared_at && new Date(row.created_at).getTime() <= new Date(preference.cleared_at).getTime()) continue;
      const preview = row.message_type === "voice" ? "🎙 Voice message"
        : row.message_type === "image" ? "📷 Photo"
        : row.message_type === "video" ? "🎬 Video"
        : row.content || "Message";
      latestByContact.set(contactId, { preview, created_at: row.created_at });
    }

    const contactIds = Array.from(latestByContact.keys());
    if (!contactIds.length) {
      setRecentChats([]);
      return;
    }
    const { data: contactProfiles, error: profileError } = await supabase.from("profiles")
      .select("id,username,full_name,avatar_url,is_private")
      .in("id", contactIds);
    if (profileError) throw profileError;
    const profileById = new Map((contactProfiles ?? []).map((profile) => [profile.id, profile as Profile]));
    setRecentChats(contactIds.map((id) => ({
      profile: profileById.get(id) ?? { id, username: null, full_name: null, avatar_url: null },
      preview: latestByContact.get(id)?.preview ?? "Message",
      lastMessageAt: latestByContact.get(id)?.created_at ?? "",
    })));
  }, [userId, chatPreferences]);

  useEffect(() => {
    if (!userId) return;
    void loadRecentChats().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load recent chats."));
  }, [userId, loadRecentChats]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("home-chat-list-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "sender_id=eq." + userId }, () => {
        void loadRecentChats().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh chats."));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "receiver_id=eq." + userId }, () => {
        void loadRecentChats().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh chats."));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadRecentChats]);

  const loadMessages = useCallback(async (friendId: string, requestId: number) => {
    if (!userId) return;
    const { data, error: messageError } = await supabase.from("messages")
      .select("id,sender_id,receiver_id,content,created_at,read_at,edited_at,message_type,media_path,media_expires_at,media_expired,expires_at,reply_to_id,reply_to_content,reply_to_sender_id")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: false }).limit(100);
    if (messageError) throw messageError;
    if (requestId !== messageLoadRequestRef.current) return;
    const pref = chatPreferences.find((item) => item.friend_id === friendId);
    const visible = (data ?? []).filter((item) => (!pref?.cleared_at || new Date(item.created_at) > new Date(pref.cleared_at)) && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now()));
    const now = Date.now();
    const mediaItems = visible.filter((item) => item.media_path && !item.media_expired && item.media_expires_at && new Date(item.media_expires_at).getTime() > now);
    const uniquePaths = Array.from(new Set(mediaItems.map((item) => item.media_path as string)));
    const shortestExpiry = mediaItems.length
      ? Math.max(1, Math.floor(Math.min(...mediaItems.map((item) => new Date(item.media_expires_at as string).getTime() - now)) / 1000))
      : 60;
    const signedUrlByPath = new Map<string, string>();
    if (uniquePaths.length) {
      const { data: signedRows, error: signedError } = await supabase.storage.from("connectx-temporary-chat-media").createSignedUrls(uniquePaths, shortestExpiry);
      if (signedError) throw signedError;
      if (requestId !== messageLoadRequestRef.current) return;
      for (const signed of signedRows ?? []) {
        if (signed.path && signed.signedUrl) signedUrlByPath.set(signed.path, signed.signedUrl);
      }
    }
    const messagesWithUrls = visible.map((item) => ({
      ...item,
      media_url: item.media_path && !item.media_expired && item.media_expires_at && new Date(item.media_expires_at).getTime() > now
        ? signedUrlByPath.get(item.media_path) ?? null
        : null,
    }));
    if (requestId !== messageLoadRequestRef.current) return;
    setMessages((messagesWithUrls as DirectMessage[]).reverse());
    const ids = visible.map((item) => item.id);
    if (ids.length) {
      const { data: reactionRows, error: reactionError } = await supabase.from("message_reactions")
        .select("id,message_id,user_id,emoji").in("message_id", ids);
      if (reactionError) throw reactionError;
      if (requestId !== messageLoadRequestRef.current) return;
      setReactions((reactionRows ?? []) as MessageReaction[]);
    } else setReactions([]);
    if (requestId !== messageLoadRequestRef.current) return;
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("sender_id", friendId).eq("receiver_id", userId).is("read_at", null);
  }, [userId, chatPreferences]);

  useEffect(() => {
    if (!userId || !selectedFriend) {
      messageLoadRequestRef.current += 1;
      setMessages([]);
      setReactions([]);
      return;
    }
    let active = true;
    const requestId = ++messageLoadRequestRef.current;
    setMessages([]);
    setReactions([]);
    loadMessages(selectedFriend.id, requestId).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load messages.");
    });
    const handleDirectMessage = (payload: { new: Record<string, unknown> }) => {
      if (!active) return;
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
        if (!active) return;
        setMessages((old) => old.some((item) => item.id === incoming.id) ? old : [...old, incoming]);
      })();
    };
    // Subscribe only to rows involving this account, rather than receiving every
    // message in the project and discarding unrelated conversations on-device.
    const handleDirectMessageUpdate = (payload: { new: Record<string, unknown> }) => {
      if (!active) return;
      const row = payload.new as unknown as DirectMessage;
      const belongsToChat =
        (row.sender_id === userId && row.receiver_id === selectedFriend.id) ||
        (row.sender_id === selectedFriend.id && row.receiver_id === userId);
      if (!belongsToChat) return;
      setMessages((old) => old.map((item) => item.id === row.id
        ? { ...item, content: row.content, edited_at: row.edited_at ?? null }
        : item));
    };
    const channel = supabase.channel(`direct-messages-${userId}-${selectedFriend.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` }, handleDirectMessage)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` }, handleDirectMessage)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` }, handleDirectMessageUpdate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` }, handleDirectMessageUpdate)
      .subscribe();
    return () => {
      active = false;
      if (messageLoadRequestRef.current === requestId) messageLoadRequestRef.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [userId, selectedFriend, loadMessages]);

  async function chooseFriend(friend: Profile) {
    if (friend.is_private && friend.id !== userId && !acceptedIds.has(friend.id)) {
      setNotice("This is a private profile. Send a friend request and wait for acceptance before messaging.");
      return;
    }
    if (selectionMode) {
      setSelectedChats((old) => old.includes(friend.id) ? old.filter((id) => id !== friend.id) : [...old, friend.id]);
      return;
    }
    // Switch the active conversation type explicitly. Without clearing the
    // group selection, the group-render branch takes precedence over a friend.
    groupMessageLoadRequestRef.current += 1;
    setSelectedGroup(null);
    setGroupMessages([]);
    setSelectedFriend(friend);
    setShowMobileChat(true);
    setTab("Messages");
    setError("");
  }

  async function sendRequest(profile: Profile) {
    if (!userId || requestSendingProfileId === profile.id || pendingRequestProfileIds.includes(profile.id)) return;
    setRequestSendingProfileId(profile.id);
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
      setPendingRequestProfileIds((current) => current.includes(profile.id) ? current : [...current, profile.id]);
      await refreshRequests();
      setNotice(`Friend request sent to ${displayName(profile)}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send friend request.");
    } finally {
      setBusy(false);
      setRequestSendingProfileId((current) => current === profile.id ? null : current);
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

  function persistChatLocks(next: string[]) {
    setChatLockIds(next);
    try { localStorage.setItem("connectx-chat-locks-" + userId, JSON.stringify(next)); } catch {}
  }
  function randomChallenge() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytes;
  }
  async function enrollChatLock() {
    if (!chatLockSupported || !userId) { setError("This browser or device does not support biometric/passkey authentication."); return; }
    setChatLockBusy(true);
    try {
      const credential = await navigator.credentials.create({ publicKey: {
        challenge: randomChallenge(), rp: { name: "ConnectX" },
        user: { id: new TextEncoder().encode(userId), name: userId, displayName: myProfile?.full_name || "ConnectX user" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000, attestation: "none"
      } }) as PublicKeyCredential | null;
      if (!credential) throw new Error("Biometric setup was cancelled.");
      const id = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem("connectx-chat-lock-credential-" + userId, id);
      setChatLockCredential(id);
      setNotice("Chat Lock biometric verification is enabled on this device.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not enable biometric verification."); }
    finally { setChatLockBusy(false); }
  }
  async function verifyChatLock() {
    if (!chatLockCredential) { setError("Enable Chat Lock verification in Settings first."); return false; }
    setChatLockBusy(true);
    try {
      const idBytes = Uint8Array.from(atob(chatLockCredential), c => c.charCodeAt(0));
      const credential = await navigator.credentials.get({ publicKey: {
        challenge: randomChallenge(), allowCredentials: [{ type: "public-key", id: idBytes }],
        userVerification: "required", timeout: 60000
      } });
      if (!credential) throw new Error("Biometric verification was cancelled.");
      setChatLockUnlocked(true);
      setShowLockedChats(true);
      setNotice("Chat Lock unlocked.");
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Biometric verification failed."); return false; }
    finally { setChatLockBusy(false); }
  }
  function toggleChatLock(id: string) {
    if (!chatLockCredential) { setError("First enable fingerprint/biometric verification in Settings."); setTab("Settings"); return; }
    const next = chatLockIds.includes(id) ? chatLockIds.filter(x => x !== id) : [...chatLockIds, id];
    persistChatLocks(next);
    setNotice(next.includes(id) ? "Chat moved to Chat Lock." : "Chat removed from Chat Lock.");
  }

  async function saveEditedMessage(message: DirectMessage) {
    const content = editMessageDraft.trim();
    if (!content || content.length > 5000 || message.sender_id !== userId || editMessageBusy) return;
    setEditMessageBusy(true);
    try {
      const editedAt = new Date().toISOString();
      const { data, error: updateError } = await supabase.from("messages").update({ content, edited_at: editedAt })
        .eq("id", message.id).eq("sender_id", userId).select("id,content,edited_at").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Message could not be edited. Refresh and try again.");
      setMessages((old) => old.map((item) => item.id === message.id ? { ...item, content: data.content, edited_at: data.edited_at } : item));
      setEditingMessageId(null); setEditMessageDraft(""); setNotice("Message edited.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not edit message."); }
    finally { setEditMessageBusy(false); }
  }
  async function saveEditedGroupMessage(message: GroupMessage) {
    const content = editGroupMessageDraft.trim();
    if (!content || content.length > 5000 || message.sender_id !== userId || !selectedGroup || editGroupMessageBusy) return;
    if (content === message.content) {
      setEditingGroupMessageId(null); setEditGroupMessageDraft(""); return;
    }
    setEditGroupMessageBusy(true); setError(""); setNotice("");
    try {
      const editedAt = new Date().toISOString();
      const { data, error: updateError } = await supabase.from("chat_group_messages")
        .update({ content, edited_at: editedAt })
        .eq("id", message.id).eq("group_id", selectedGroup.id).eq("sender_id", userId)
        .select("id,content,edited_at").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Group message could not be edited. Refresh the group and try again.");
      setGroupMessages((old) => old.map((item) => item.id === message.id
        ? { ...item, content: data.content, edited_at: data.edited_at }
        : item));
      setEditingGroupMessageId(null); setEditGroupMessageDraft(""); setNotice("Group message edited.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not edit group message.");
    } finally {
      setEditGroupMessageBusy(false);
    }
  }

  async function copyMessage(message: DirectMessage) {
    try { await navigator.clipboard.writeText(message.content); setNotice("Message copied."); }
    catch { setError("Could not copy message. Check clipboard permission."); }
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
      setChatActionMenuId(friendId);
    }, 1000);
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
    const visibleOwnerIds = [userId, ...Array.from(acceptedIds)];
    const {data,error}=await supabase.from("status_updates").select("id,user_id,caption,media_url,media_type,created_at,expires_at").in("user_id",visibleOwnerIds).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100);
    if(error)throw error; setStatuses((data??[]) as StatusUpdate[]);
  },[userId,acceptedIds]);
  useEffect(()=>{if(userId)void loadStatuses().catch(e=>setError(e.message));},[userId,loadStatuses]);

  const refreshApp = useCallback(async () => {
    if (!userId || refreshing) return;
    const startedAt = Date.now();
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      await Promise.all([loadBase(userId), loadChatPreferences(), loadGroups(), loadStatuses(), loadRecentChats()]);
      if (selectedFriend) {
        const requestId = ++messageLoadRequestRef.current;
        await loadMessages(selectedFriend.id, requestId);
      }
      if (selectedGroup) {
        const requestId = ++groupMessageLoadRequestRef.current;
        const { data, error: groupMessagesError } = await supabase.from("chat_group_messages")
          .select("id,group_id,sender_id,content,created_at,edited_at,deleted_for_everyone,reply_to_id,reply_to_content,reply_to_sender_id")
          .eq("group_id", selectedGroup.id).order("created_at", { ascending: false }).limit(100);
        if (groupMessagesError) throw groupMessagesError;
        if (requestId === groupMessageLoadRequestRef.current) {
          setGroupMessages(((data ?? []) as GroupMessage[]).reverse());
          await Promise.all([loadGroupProfile(selectedGroup), loadGroupFeed(selectedGroup)]);
        }
      }
      setNotice("ConnectX refreshed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh ConnectX. Please try again.");
    } finally {
      const remaining = 650 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setRefreshing(false);
    }
  }, [userId, refreshing, loadBase, loadChatPreferences, loadGroups, loadStatuses, loadRecentChats, selectedFriend, loadMessages, selectedGroup, loadGroupProfile, loadGroupFeed]);

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
    void loadRecentChats().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh chats."));
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
      void loadRecentChats().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh chats."));
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
      recorder.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        if(recorderRef.current===recorder)recorderRef.current=null;
        if(voiceCancelRef.current){chunksRef.current=[];voiceCancelRef.current=false;setVoiceBlob(null);setVoicePreview("");return;}
        const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});
        if(blob.size){
          setVoiceBlob(blob);setVoicePreview(URL.createObjectURL(blob));
          if(voiceAutoSendRef.current){voiceAutoSendRef.current=false;void sendVoiceMessage(blob);}
        }
      };
      recorderRef.current=recorder;recorder.start();setRecording(true);setRecordingSeconds(0);
      if(stopAfterStartRef.current&&!voiceLockedRef.current){stopAfterStartRef.current=false;recorder.stop();setRecording(false);}
    }catch(e){setRecording(false);setRecordingLocked(false);voiceGestureRef.current=null;voiceLockedRef.current=false;stopAfterStartRef.current=false;setError(e instanceof Error?e.message:"Microphone access failed.");}
  }
  function stopVoiceRecording(){
    if(recorderRef.current?.state==="recording"){recorderRef.current.stop();setRecording(false);}
    else if(!recorderRef.current||recorderRef.current.state==="inactive"){stopAfterStartRef.current=true;}
  }
  function cancelVoiceRecording(){
    voiceCancelRef.current=true;voiceAutoSendRef.current=false;voiceLockedRef.current=false;setRecordingLocked(false);setRecording(false);
    if(recorderRef.current?.state==="recording")recorderRef.current.stop();
    else if(!recorderRef.current||recorderRef.current.state==="inactive")stopAfterStartRef.current=true;
  }
  function handleVoicePointerDown(event:ReactPointerEvent<HTMLButtonElement>){
    if(busy||voiceBlob||attachment||recording)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    voiceGestureRef.current={x:event.clientX,y:event.clientY};voiceLockedRef.current=false;voiceCancelRef.current=false;stopAfterStartRef.current=false;
    void startVoiceRecording();
  }
  function handleVoicePointerMove(event:ReactPointerEvent<HTMLButtonElement>){
    const start=voiceGestureRef.current;if(!start)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(dx < -85){voiceGestureRef.current=null;cancelVoiceRecording();return;}
    if(dy < -70&&!voiceLockedRef.current){voiceLockedRef.current=true;setRecordingLocked(true);}
  }
  function handleVoicePointerUp(){
    if(!voiceGestureRef.current)return;
    voiceGestureRef.current=null;
    if(!voiceLockedRef.current){voiceAutoSendRef.current=true;stopVoiceRecording();}
  }
  function handleVoicePointerCancel(){if(voiceGestureRef.current){voiceGestureRef.current=null;cancelVoiceRecording();}}
  async function saveDisappearingSetting(hours: number) {
    if (!friendProfile || !userId || disappearingBusy) return;
    setDisappearingBusy(true);
    try {
      const [user_one, user_two] = [userId, friendProfile.id].sort();
      const { error: saveError } = await supabase.from("chat_disappearing_settings").upsert({ user_one, user_two, duration_hours: hours, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "user_one,user_two" });
      if (saveError) throw saveError;
      setDisappearingHours(hours);
      setNotice(hours === 0 ? "Disappearing messages turned off." : `New messages will disappear after ${hours === 24 ? "24 hours" : hours === 168 ? "7 days" : "30 days"}.`);
      if (selectedFriend?.id === friendProfile.id) { const requestId = ++messageLoadRequestRef.current; await loadMessages(friendProfile.id, requestId); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update disappearing messages."); }
    finally { setDisappearingBusy(false); }
  }

  async function sendVoiceMessage(blobToSend:Blob|null=voiceBlob){
    const voiceFile=blobToSend;
    if(!voiceFile||!userId||!selectedFriend||busy)return;
    if(blockedWithSelected){setError("You cannot send messages because one of you has blocked the other.");return;}
    if(selectedFriend.is_private && selectedFriend.id !== userId && !acceptedIds.has(selectedFriend.id)){
      setError("This private profile only accepts messages from friends.");
      return;
    }
    setBusy(true);setError("");
    try{
      const ext=voiceFile.type.includes("mp4")?"m4a":"webm";
      const key=userId+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await supabase.storage.from("connectx-voice-notes").upload(key,voiceFile,{contentType:voiceFile.type});
      if(uploadError)throw uploadError;
      const url=supabase.storage.from("connectx-voice-notes").getPublicUrl(key).data.publicUrl;
      const expiresAt = disappearingHours ? new Date(Date.now() + disappearingHours * 60 * 60 * 1000).toISOString() : null;
      const {data,error:insertError}=await supabase.from("messages").insert({sender_id:userId,receiver_id:selectedFriend.id,content:url,message_type:"voice",expires_at:expiresAt,reply_to_id:replyTarget?.kind === "direct" ? replyTarget.id : null,reply_to_content:replyTarget?.kind === "direct" ? replyTarget.content : null,reply_to_sender_id:replyTarget?.kind === "direct" ? replyTarget.sender_id : null}).select("id,sender_id,receiver_id,content,created_at,read_at,message_type,expires_at,reply_to_id,reply_to_content,reply_to_sender_id").single();
      if(insertError)throw insertError;
      setMessages(old=>[...old,data as DirectMessage]);void loadRecentChats().catch((reason)=>setError(reason instanceof Error?reason.message:"Could not refresh chats."));setReplyTarget(null);setVoiceBlob(null);if(voicePreview)URL.revokeObjectURL(voicePreview);setVoicePreview("");voiceAutoSendRef.current=false;
    }catch(e){setError(e instanceof Error?e.message:"Could not send voice message.");}
    finally{setBusy(false);}
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = draft.trim();
    const file = attachment;
    const friend = selectedFriend;
    if (!friend || !userId || busy) return;
    if (blockedWithSelected) { setError("You cannot send messages because one of you has blocked the other."); return; }
    if (friend.is_private && friend.id !== userId && !acceptedIds.has(friend.id)) {
      setError("This private profile only accepts messages from friends.");
      return;
    }
    if (!text && !file) { setError("Choose a photo or enter a message before sending."); return; }

    // Text messages appear immediately; the database insert is reconciled by id
    // when it returns or when the realtime event arrives first.
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const reply = replyTarget?.kind === "direct" ? replyTarget : null;
    if (!file) {
      const optimistic: DirectMessage = {
        id: optimisticId,
        sender_id: userId,
        receiver_id: friend.id,
        content: text,
        created_at: new Date().toISOString(),
        read_at: null,
        message_type: "text",
        reply_to_id: reply?.id ?? null,
        reply_to_content: reply?.content ?? null,
        reply_to_sender_id: reply?.sender_id ?? null,
      };
      setMessages((old) => [...old, optimistic]);
    }

    setBusy(true);
    setError("");
    let uploadedPath: string | null = null;
    try {
      let insertPayload: Record<string, unknown> = {
        sender_id: userId,
        receiver_id: friend.id,
        reply_to_id: reply?.id ?? null,
        reply_to_content: reply?.content ?? null,
        reply_to_sender_id: reply?.sender_id ?? null,
        content: text,
        message_type: "text",
        expires_at: disappearingHours ? new Date(Date.now() + disappearingHours * 60 * 60 * 1000).toISOString() : null,
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
          sender_id: userId,
          receiver_id: friend.id,
          reply_to_id: reply?.id ?? null,
          reply_to_content: reply?.content ?? null,
          reply_to_sender_id: reply?.sender_id ?? null,
          content: text || file.name,
          message_type: file.type.startsWith("video/") ? "video" : "image",
          media_path: uploadedPath,
          media_expires_at: expiresAt,
          media_expired: false,
          expires_at: disappearingHours ? new Date(Date.now() + disappearingHours * 60 * 60 * 1000).toISOString() : null,
        };
      }

      const { data, error: insertError } = await supabase.from("messages").insert(insertPayload)
        .select("id,sender_id,receiver_id,content,created_at,read_at,message_type,media_path,media_expires_at,media_expired,expires_at,reply_to_id,reply_to_content,reply_to_sender_id")
        .single();
      if (insertError) throw insertError;
      if (!data) throw new Error("Message was not saved. Please try again.");

      const sentMessage = data as DirectMessage;
      void loadRecentChats().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh chats."));
      setMessages((old) => {
        const withoutOptimistic = old.filter((item) => item.id !== optimisticId);
        return withoutOptimistic.some((item) => item.id === sentMessage.id)
          ? withoutOptimistic.map((item) => item.id === sentMessage.id ? { ...item, ...sentMessage } : item)
          : [...withoutOptimistic, sentMessage];
      });
      setDraft("");
      setReplyTarget(null);
      setAttachment(null);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      if (typingChannel.current) void typingChannel.current.send({ type: "broadcast", event: "typing", payload: { typing: false } });

      // Do not make the message bubble wait for a signed media URL.
      if (sentMessage.media_path && sentMessage.media_expires_at) {
        const remaining = Math.max(1, Math.floor((new Date(sentMessage.media_expires_at).getTime() - Date.now()) / 1000));
        void supabase.storage.from("connectx-temporary-chat-media")
          .createSignedUrl(sentMessage.media_path, remaining)
          .then(({ data: signed }) => {
            if (signed?.signedUrl) setMessages((old) => old.map((item) => item.id === sentMessage.id ? { ...item, media_url: signed.signedUrl } : item));
          });
      }
    } catch (reason) {
      setMessages((old) => old.filter((item) => item.id !== optimisticId));
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
    if (!username) { setError("Choose a unique username before using ConnectX."); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
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

  useEffect(() => {
    let cancelled = false;
    if (!userId || !selectedFriend || selectedFriend.id === userId) { setBlockedWithSelected(false); return; }
    void supabase.rpc("connectx_user_blocked", { user_a: userId, user_b: selectedFriend.id }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setError(error.message); return; }
      setBlockedWithSelected(!!data);
    });
    return () => { cancelled = true; };
  }, [userId, selectedFriend?.id]);

  async function toggleBlockSelected() {
    const friend = selectedFriend;
    if (!friend || !userId || friend.id === userId || blockActionBusy) return;
    setBlockActionBusy(true); setError("");
    try {
      if (blockedWithSelected) {
        const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", friend.id);
        if (error) throw error;
        setBlockedWithSelected(false);
        setNotice("User unblocked. You can message each other again.");
      } else {
        const { error } = await supabase.from("blocked_users").insert({ blocker_id: userId, blocked_id: friend.id });
        if (error) throw error;
        setBlockedWithSelected(true);
        setNotice("User blocked. Messages between you are now disabled.");
      }
      setChatMenuOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update block settings.");
    } finally { setBlockActionBusy(false); }
  }

  async function broadcastTyping(value: string) {
    if (!typingChannel.current) return;
    await typingChannel.current.send({ type: "broadcast", event: "typing", payload: { typing: !!value.trim() } });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (value.trim()) typingTimeout.current = setTimeout(() => {
      void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { typing: false } });
    }, 1800);
  }

  const activeName = selectedFriend ? displayName(selectedFriend) : "";

  async function askConnectXIntelligence(promptOverride?: string, mode = "assistant") {
    const question = (promptOverride ?? intelligenceInput).trim();
    if (!question || intelligenceBusy) return;
    setIntelligenceInput("");
    setIntelligenceError("");
    setIntelligenceBusy(true);
    setIntelligenceTurns((current)=>[...current,{id:"u-"+Date.now(),role:"user",content:question}]);
    try {
      const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
      if(sessionError) throw sessionError;
      const token=sessionData.session?.access_token;
      if(!token) throw new Error("Your session expired. Sign in again.");
      let context:Array<{role:"user"|"assistant";content:string}>=[];
      let contextLabel="General ConnectX assistant";
      if(intelligenceUseContext && selectedGroup){
        contextLabel="Group: "+selectedGroup.name;
        context=groupMessages.filter((message)=>!message.deleted_for_everyone).slice(-35).map((message)=>({
          role:"user" as const,
          content:(profiles.find((profile)=>profile.id===message.sender_id)?.full_name || profiles.find((profile)=>profile.id===message.sender_id)?.username || (message.sender_id===userId?"You":"Member"))+": "+message.content
        }));
      } else if(intelligenceUseContext && selectedFriend){
        contextLabel="Chat with "+displayName(selectedFriend);
        context=messages.slice(-35).map((message)=>({
          role:"user" as const,
          content:(message.sender_id===userId?"You":displayName(selectedFriend))+": "+message.content
        }));
      }
      const response=await fetch("/api/intelligence",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({question,mode,context,contextLabel})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload.error || "ConnectX Intelligence could not answer.");
      setIntelligenceTurns((current)=>[...current,{id:"a-"+Date.now(),role:"assistant",content:payload.answer}]);
    } catch(reason) {
      setIntelligenceError(reason instanceof Error?reason.message:"Something went wrong. Try again.");
    } finally {
      setIntelligenceBusy(false);
    }
  }

  useEffect(()=>{
    if(intelligenceOpen) intelligenceScrollRef.current?.scrollTo({top:intelligenceScrollRef.current.scrollHeight,behavior:"smooth"});
  },[intelligenceTurns,intelligenceBusy,intelligenceOpen]);

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
    const receivedStream = new MediaStream();
    pc.ontrack = (event) => {
      const incoming = event.streams[0];
      if (incoming) {
        setRemoteStream(incoming);
        return;
      }
      if (!receivedStream.getTracks().some((track) => track.id === event.track.id)) receivedStream.addTrack(event.track);
      setRemoteStream(new MediaStream(receivedStream.getTracks()));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setCallStatus("Connected");
      if (pc.connectionState === "failed") setCallStatus("Connection failed. A TURN relay may be required on this network.");
      if (pc.connectionState === "disconnected") setCallStatus("Connection interrupted. Trying to reconnect…");
      if (pc.connectionState === "closed") setCallStatus("Call ended");
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "checking") setCallStatus("Connecting devices…");
      if (pc.iceConnectionState === "failed") setCallStatus("Could not establish a media route. This network may require TURN.");
      if (pc.iceConnectionState === "disconnected") setCallStatus("Network interrupted. Reconnecting…");
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

  function callFailureMessage(reason: unknown, mode: "audio" | "video") {
    const issue = reason as {
      name?: string; message?: string; details?: string; hint?: string; code?: string;
      status?: number; statusCode?: string;
    };
    const name = String(issue?.name ?? "");
    const detail = [issue?.message, issue?.details, issue?.hint, issue?.code, issue?.statusCode]
      .filter((value) => value !== undefined && value !== null && String(value).trim())
      .map(String).join(" · ");
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return "Microphone/camera access was blocked. In Android, open Chrome → Site settings → Microphone and Camera → Allow for connectx-sandy.vercel.app, then retry. Also check Android Settings → Apps → Chrome → Permissions.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return mode === "video" ? "No camera or microphone was found. Check that both devices are available." : "No microphone was found. Check that a microphone is available.";
    }
    if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
      return "The microphone or camera is busy or unavailable. Close other apps using it and retry.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "The camera or microphone does not support the requested settings. Check the device and retry.";
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "Calls require HTTPS. Open ConnectX from its secure https:// address.";
    }
    if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      return "This browser does not expose microphone/camera access. Open ConnectX directly in an updated Chrome browser over HTTPS, not inside an in-app browser.";
    }
    return detail || "The call could not start. Check microphone/camera permissions and try again.";
  }

  async function requestCallMedia(mode: "audio" | "video") {
    if (typeof window === "undefined" || !window.isSecureContext) {
      throw new DOMException("Calls require a secure HTTPS page.", "SecurityError");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not expose microphone/camera access. Open ConnectX directly in Chrome over HTTPS.");
    }
    // Keep constraints deliberately simple for Android devices; advanced audio
    // processing constraints can cause avoidable getUserMedia failures.
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? { facingMode: { ideal: "user" } } : false,
    });
  }

  async function startCall(mode: "audio" | "video") {
    setCallFeedback("");
    if (!selectedFriend) { setCallFeedback("Open a chat before starting a call."); return; }
    if (!userId) { setCallFeedback("Your session is not ready. Sign in again and retry."); return; }
    if (!acceptedIds.has(selectedFriend.id)) { setCallFeedback("You can call only after both people accept the friend request."); return; }
    if (activeCall || incomingCall) { setCallFeedback("Another call is already active."); return; }
    setError(""); setNotice(""); setCallStatus("Requesting microphone and camera access…");
    let stream: MediaStream | null = null;
    try {
      stream = await requestCallMedia(mode);
      setCallStatus("Preparing secure call…");
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
      pendingLocalCandidates.current = [];
      setCallStatus("");
      const message = callFailureMessage(reason, mode);
      console.error("ConnectX call start failed", reason);
      setCallFeedback(message);
      setError(message);
    }
  }

  async function acceptCall(call: CallSession) {
    let stream: MediaStream | null = null;
    setError(""); setCallFeedback(""); setCallStatus("Requesting microphone and camera access…");
    try {
      stream = await requestCallMedia(call.call_type);
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
      await flushLocalCandidates(call.id);
      setLocalStream(stream);
      setCallMode(call.call_type);
      setActiveCall(call);
      setIncomingCall(null);
      setCallStatus("Connecting…");
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close(); pcRef.current = null; callIdRef.current = "";
      pendingLocalCandidates.current = [];
      setCallStatus("");
      const message = callFailureMessage(reason, call.call_type);
      console.error("ConnectX call accept failed", reason);
      setCallFeedback(message);
      setError(message);
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
            onClick={() => { setTab(item); setShowMobileChat(false); }} aria-label={tr(item)} title={tr(item)}>
            {["▤", "◉", "♙", "⚙"][index]}
          </button>
        ))}
        <div className="rail-spacer" /><div className="cx-user">{initials(myProfile?.full_name || myProfile?.username || "U")}</div>
      </aside>

      {userId && myProfile && !myProfile.username && <div className="username-onboarding-backdrop"><form className="username-onboarding" onSubmit={saveProfile}><div className="username-onboarding-mark">CX</div><p className="username-onboarding-kicker">ONE CONNECTX ID</p><h1>Choose your username</h1><p>Your unique username helps friends find you. You can connect without sharing your email.</p><label className="username-onboarding-label">USERNAME<div className="username-onboarding-input"><span>@</span><input autoFocus value={profileUsername} onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" placeholder="yourname" required /></div></label><small>3–20 characters · letters, numbers and underscore. Must be unique.</small>{error && <p className="username-onboarding-error">{error}</p>}<button className="action-btn" type="submit" disabled={savingProfile || profileUsername.trim().length < 3}>{savingProfile ? "Checking username…" : "Continue to ConnectX"}</button></form></div>}
      <section className={`cx-list ${showMobileChat ? "hide-mobile" : ""}`} onTouchStart={handleMainTabTouchStart} onTouchEnd={handleMainTabTouchEnd}>
        <header className="list-head">
          <div><div className="cx-brand"><span>✦</span> ConnectX</div><p>{tr("Your space to connect")}</p></div>
          <div className="list-head-actions"><button type="button" className="intelligence-launcher" aria-label="Open ConnectX Intelligence" onClick={() => setIntelligenceOpen(true)}><span className="intelligence-orb">✦</span><span className="intelligence-launcher-label">AI</span></button><button className="icon-btn header-profile" aria-label="Open settings" onClick={() => { setTab("Settings"); setShowMobileChat(false); }}>{myProfile?.avatar_url ? <img src={myProfile.avatar_url} alt="" /> : initials(myProfile?.full_name || myProfile?.username || "U")}</button></div>
        </header>

        {tab !== "Settings" && <div className="search-row"><div className="search-box"><span className="search-icon">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "Friends" ? tr("Search exact username (e.g. @samarth)") : tr("Search friends")} />
          <button type="button" className={`refresh-btn ${refreshing ? "is-refreshing" : ""}`} aria-label={refreshing ? "Refreshing" : tr("Refresh")} title={refreshing ? "Refreshing…" : tr("Refresh")} disabled={refreshing || !userId} onClick={refreshApp}><span>↻</span></button>
        </div></div>}

        <div className="list-label">{tr(tab).toUpperCase()} <span>{tab === "Friends" ? filteredProfiles.length : tab === "Messages" ? homeChats.length : ""}</span></div>

        {loading ? <p className="empty">{tr("Loading your account…")}</p> : tab === "Settings" ? (
          <form className="settings-panel profile-editor" onSubmit={saveProfile}>
            <div className="settings-section-title"><span>01</span> {tr("Your profile").toUpperCase()}</div>
            <div className="profile-photo-wrap">
              {myProfile?.avatar_url && !avatarFile ? <img className="profile-photo" src={myProfile.avatar_url} alt="Your profile" /> : <div className="large-avatar">{initials(profileName || profileUsername || "U")}</div>}
            </div>
            <label className="profile-field">{tr("Profile photo")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /></label>
            <label className="profile-field">{tr("Display name")}<input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={60} placeholder={tr("Your name")} /></label>
            <label className="profile-field">{tr("Username")}<input value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} maxLength={20} placeholder="username" autoCapitalize="none" /></label>
            <small className="profile-hint">3–20 characters · letters, numbers and underscores</small>
            <label className="profile-field">{tr("Bio")}<textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} maxLength={160} rows={3} placeholder={tr("A little about you…")} /></label>
            <small className="profile-hint">{profileBio.length}/160 characters</small>
            <div className="settings-section-title"><span>02</span> {tr("Appearance").toUpperCase()}</div>
            <label className="privacy-option"><span><strong>{tr("Dark mode")}</strong><small>{tr("Use a darker theme across ConnectX")}</small></span><input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} /></label>
            <div className="settings-section-title"><span>03</span> {tr("Chat lock & security").toUpperCase()}</div>
            <div className="privacy-option"><span><strong>{tr("Fingerprint / biometric verification")}</strong><small>Required before opening your locked chats. Uses your device's passkey prompt.</small></span><button type="button" className="mini-btn" disabled={chatLockBusy || !chatLockSupported} onClick={() => void enrollChatLock()}>{chatLockCredential ? tr("Set up again") : tr("Enable")}</button></div>
            {!chatLockSupported && <small className="profile-hint">{tr("Biometric/passkey authentication is not available in this browser. Try a supported browser on a device with screen lock enabled.")}</small>}
            {chatLockCredential && <small className="profile-hint">{tr("Verification is configured on this device. Locked chats:")} {chatLockIds.length}.</small>}
            <div className="settings-section-title"><span>04</span> {tr("Privacy").toUpperCase()}</div>
            <label className="privacy-option"><span><strong>{tr("Private profile")}</strong><small>{tr("Privacy preference for future profile discovery controls")}</small></span><input type="checkbox" checked={profilePrivate} onChange={(e) => setProfilePrivate(e.target.checked)} /></label>
            <label className="privacy-option"><span><strong>{tr("Show last seen")}</strong><small>{tr("Allow friends to see your last active time when presence is added")}</small></span><input type="checkbox" checked={showLastSeen} onChange={(e) => setShowLastSeen(e.target.checked)} /></label>
            <div className="settings-section-title"><span>05</span> {tr("Change language").toUpperCase()}</div>
            <label className="profile-field">{tr("Change language")}<select value={appLanguage} disabled={languageSaving} onChange={(event) => void changeAppLanguage(event.target.value)}>{APP_LANGUAGES.map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <small className="profile-hint">{languageSaving ? tr("Saving language preference…") : tr("Choose your app language")}</small>
            <button className="action-btn" type="submit" disabled={savingProfile}>{savingProfile ? tr("Saving…") : tr("Save profile")}</button>
            <button className="action-btn secondary" type="button" onClick={signOut} disabled={busy || savingProfile}>{tr("Sign out")}</button>
            <div className="app-version-card" aria-label="Application version">
              <span className="app-version-mark">CX</span>
              <span className="app-version-copy"><strong>ConnectX</strong><small>{tr("Current app release")}</small></span>
              <span className="app-version-number">v0.1.1 · Beta</span>
            </div>
          </form>
        ) : tab === "Status" ? (
          <div className="cx-chats status-panel">
            <div className="status-topbar"><div><h2>{tr("Updates")}</h2><p>{tr("Share what’s happening")}</p></div><button type="button" className="status-camera" onClick={() => setShowStatusComposer(true)} aria-label="Add status">＋</button></div>
            <div className="status-list">
              <button type="button" className="status-person my-status-row" onClick={() => myStatuses.length ? (setViewingStatusUser(userId),setViewingStatusIndex(Math.max(0,myStatuses.length-1))) : setShowStatusComposer(true)}>
                <span className="status-avatar-wrap own"><span className="status-avatar">{myProfile?.avatar_url ? <img src={myProfile.avatar_url} alt="" /> : initials(displayName(myProfile ?? {id:userId,username:null,full_name:"You",avatar_url:null}))}</span><i>＋</i></span>
                <span className="status-person-copy"><strong>{tr("My status")}</strong><small>{myStatuses.length ? "Tap to add another update" : "Tap to add status update"}</small></span>
                <span className="status-add-label">{tr("Add")}</span>
              </button>
              {myStatuses[0] && <div className="my-status-preview">{myStatuses[0].media_url ? (myStatuses[0].media_type === "video" ? "Video status" : "Photo status") : (myStatuses[0].caption || "Text status")} · {new Date(myStatuses[0].created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
            {statusGroups.length > 0 && <>
              <div className="status-section-title">{tr("Recent updates").toUpperCase()}</div>
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
            {statuses.length === 0 && <div className="status-empty"><div className="status-empty-icon">◉</div><strong>{tr("No recent updates")}</strong><p>{tr("When your friends share a status, it will appear here.")}</p></div>}
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
            {search.trim() && <div className="section-caption">SEARCH RESULT</div>}
            {filteredProfiles.map((profile) => {
              const relation = requests.find((r) =>
                (r.sender_id === userId && r.receiver_id === profile.id) ||
                (r.sender_id === profile.id && r.receiver_id === userId)
              );
              const isSelf = profile.id === userId;
              const isFriend = acceptedIds.has(profile.id);
              const canMessage = isSelf || !profile.is_private || isFriend;
              const outgoingPending = relation?.status === "pending" && relation.sender_id === userId;
              const incomingPending = relation?.status === "pending" && relation.receiver_id === userId;
              return <div className="person-row" key={profile.id}>
                {profile.avatar_url ? <img className="avatar" src={profile.avatar_url} alt="" /> : <span className="avatar">{initials(displayName(profile))}</span>}
                <span className="chat-info"><strong>{displayName(profile)}</strong><small>{profile.username ? `@${profile.username}` : "ConnectX member"}{profile.is_private ? " · Private" : " · Public"}{isFriend ? " · Friend" : ""}</small></span>
                {!isSelf && !isFriend && !relation && <button className="mini-btn muted-btn" disabled={busy} onClick={() => void sendRequest(profile)}><span className={busy ? "request-send-spinner" : ""}>{busy ? "Sending…" : "Add friend"}</span></button>}
                {!isSelf && outgoingPending && <button className="mini-btn request-pending-btn" disabled><span className="request-pending-icon" aria-hidden="true">✓</span><span>Pending</span><i className="request-pending-ripple" aria-hidden="true" /></button>}
                {!isSelf && incomingPending && <button className="mini-btn muted-btn" disabled>Request received</button>}
                <button className="mini-btn" disabled={!canMessage} onClick={() => void chooseFriend(profile)}>{isSelf ? "Message yourself" : "Message"}</button>
              </div>;
            })}
            {usernameSearchLoading && <p className="empty">Searching username…</p>}
            {search.trim() && filteredProfiles.length === 0 && !usernameSearchLoading && <p className="empty">No account found for this username, or this account is already in your friends list.</p>}
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
            <div className="section-caption">🔒 {tr("CHAT LOCK")} <button type="button" className="text-btn" disabled={!chatLockCredential || chatLockBusy} onClick={() => { if (chatLockUnlocked) { setChatLockUnlocked(false); setShowLockedChats(false); } else void verifyChatLock(); }}>{chatLockUnlocked ? tr("Lock") : tr("Unlock")}</button></div>
            {showLockedChats && chatLockUnlocked && chatLockIds.map((id) => {
              if (id.startsWith("friend:")) {
                const friend = profiles.find(p => p.id === id.slice(7));
                return friend ? <div className="chat-row-wrap" key={id}><button type="button" className="chat-row" onClick={() => chooseFriend(friend)}><span className="avatar">{initials(displayName(friend))}</span><span className="chat-info"><strong>{displayName(friend)}</strong><small>{tr("Locked private chat")}</small></span></button><button type="button" className="text-btn" onClick={() => toggleChatLock(id)}>{tr("Unlock")}</button></div> : null;
              }
              const group = groups.find(g => g.id === id.slice(6));
              return group ? <div className="chat-row-wrap" key={id}><button type="button" className="group-row" onClick={() => void openGroup(group)}><span className="group-avatar">♧</span><span className="chat-info"><strong>{group.name}</strong><small>{tr("Locked group")}</small></span></button><button type="button" className="text-btn" onClick={() => toggleChatLock(id)}>{tr("Unlock")}</button></div> : null;
            })}
            {showLockedChats && chatLockUnlocked && chatLockIds.length === 0 && <p className="empty">{tr("No locked chats yet.")}</p>}
            <section className="group-tiles-section" aria-label="Your groups">
              <div className="group-tiles-heading"><strong>GROUPS <span>· {groups.length}</span></strong><button type="button" onClick={() => setShowAllGroups(value => !value)}>{showAllGroups ? "Show less" : "See all"}</button></div>
              <div className="group-tiles-row">
                <button type="button" className="group-tile group-tile-new" onClick={() => setShowCreateGroup(true)} aria-label="Create a new group"><span className="group-tile-avatar"><span>＋</span></span><strong>New</strong></button>
                {groups.filter(group => !chatLockIds.includes("group:" + group.id)).slice(0, showAllGroups ? groups.length : 7).map(group => (
                  <button type="button" className="group-tile" key={group.id} onClick={() => void openGroup(group)} onContextMenu={event => { event.preventDefault(); toggleChatLock("group:" + group.id); }}>
                    <span className="group-tile-avatar">{group.avatar_url ? <img src={group.avatar_url} alt="" /> : <span>{initials(group.name)}</span>}</span><strong>{group.name}</strong>
                  </button>
                ))}
              </div>
              {groups.length === 0 && <p className="group-empty">Create a group and bring your people together.</p>}
            </section>
            <div className="section-caption">{tr("CHATS")} <button type="button" className="text-btn" onClick={() => setShowArchivedChats((value) => !value)}>{showArchivedChats ? tr("Back to chats") : tr("Archive") + " (" + archivedFriends.length + ")"}</button></div>
            {!showArchivedChats && myProfile && <button type="button" className={"chat-row self-chat-row " + (selectedFriend?.id === userId ? "active" : "")} onClick={() => { setChatActionMenuId(null); chooseFriend(myProfile); }}>
              {myProfile.avatar_url ? <img className="avatar chat-row-photo" src={myProfile.avatar_url} alt="Your profile photo" /> : <span className="avatar">{initials(displayName(myProfile))}</span>}
              <span className="chat-info"><strong>{displayName(myProfile)} (You)</strong><small>Personal notes · Message yourself</small></span>
              <span className="self-chat-badge">You</span>
            </button>}
            {homeChats.map((friend) => {
              const preference = chatPreferences.find((item) => item.friend_id === friend.id);
              const recentChat = recentChatById.get(friend.id);
              return <div className="chat-row-wrap" key={friend.id}>
              <button className={`chat-row ${selectedFriend?.id === friend.id ? "active" : ""} ${selectedChats.includes(friend.id) ? "chat-selected" : ""}`}
                onTouchStart={() => beginLongPress(friend.id)} onTouchEnd={endLongPress} onTouchMove={endLongPress}
                onMouseDown={() => beginLongPress(friend.id)} onMouseUp={endLongPress} onMouseLeave={endLongPress}
                onClick={() => { if (longPressTriggered.current) { longPressTriggered.current = false; return; } setChatActionMenuId(null); chooseFriend(friend); }}>
                {friend.avatar_url ? <img className="avatar chat-row-photo" src={friend.avatar_url} alt={`${displayName(friend)} profile photo`} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); setPhotoViewer({ url: friend.avatar_url!, name: displayName(friend) }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setPhotoViewer({ url: friend.avatar_url!, name: displayName(friend) }); } }} /> : <span className="avatar">{initials(displayName(friend))}</span>}
                <span className="chat-info"><strong>{preference?.is_pinned ? "📌 " : ""}{displayName(friend)}{preference?.unread_at ? " •" : ""}</strong><small>{recentChat?.preview || (friend.username ? `@${friend.username}` : "Tap to open chat")}{preference?.unread_at ? " · Unread" : ""}</small></span>
              </button>
              {chatActionMenuId === friend.id && <div className="chat-row-tools">
                <button type="button" className="text-btn" onClick={() => { toggleChatLock("friend:" + friend.id); setChatActionMenuId(null); }}>{chatLockIds.includes("friend:" + friend.id) ? tr("Unlock") : tr("Chat Lock")}</button>
                <button type="button" className="text-btn" onClick={() => { void togglePinnedChat(friend.id); setChatActionMenuId(null); }}>{preference?.is_pinned ? "Unpin" : "Pin"}</button>
                <button type="button" className="text-btn" onClick={() => { void toggleUnreadChat(friend.id); setChatActionMenuId(null); }}>{preference?.unread_at ? "Mark read" : "Mark as read"}</button>
                <button type="button" className="text-btn" onClick={() => { void toggleArchivedChat(friend.id); setChatActionMenuId(null); }}>{preference?.is_archived ? tr("Restore") : tr("Archive")}</button>
              </div>}
              </div>;
            })}
            {homeChats.length === 0 && <p className="empty">{showArchivedChats ? tr("No archived chats.") : tr("No chats yet. Search for someone in Friends and send your first message.")}</p>}
          </div>
        )}
      </section>
      {showCreateGroup && <div className="status-modal-backdrop" onClick={() => setShowCreateGroup(false)}><form className="status-compose" onSubmit={createGroup} onClick={(e) => e.stopPropagation()}><div className="status-compose-head"><strong>Create a group</strong><button type="button" onClick={() => setShowCreateGroup(false)}>×</button></div><label className="profile-field">Group name<input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={60} required placeholder="e.g. Project team" /></label><label className="profile-field">Description<input value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} maxLength={300} placeholder="Optional description" /></label><div className="section-caption">ADD FRIENDS</div>{friends.map((friend) => <label className="privacy-option" key={friend.id}><span><strong>{displayName(friend)}</strong></span><input type="checkbox" checked={selectedGroupMembers.includes(friend.id)} onChange={(e) => setSelectedGroupMembers((old) => e.target.checked ? [...old, friend.id] : old.filter((id) => id !== friend.id))} /></label>)}<button className="action-btn" disabled={busy || !newGroupName.trim()}>{busy ? "Creating…" : "Create group"}</button></form></div>}

      <nav className="mobile-nav raised-nav" aria-label="Main navigation">
        <button aria-current={tab === "Messages" ? "page" : undefined} className={tab === "Messages" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Messages"); setSelectedFriend(null); groupMessageLoadRequestRef.current += 1; setSelectedGroup(null); setShowMobileChat(false); void loadGroups().catch((e) => setError(e.message)); }}>
          <span className="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5.5 9v11h13V9M9 20v-6h6v6" /></svg></span><span className="nav-label">{tr("Home")}</span>
        </button>
        <button aria-current={tab === "Status" ? "page" : undefined} className={tab === "Status" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Status"); setSelectedFriend(null); setShowMobileChat(false); }}>
          <span className="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle className="status-dot" cx="12" cy="12" r="2.1"/></svg></span><span className="nav-label">{tr("Status")}</span>
        </button>
        <button aria-current={tab === "Friends" ? "page" : undefined} className={tab === "Friends" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Friends"); setShowMobileChat(false); }}>
          <span className="nav-icon friends-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.4a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 4.5a3.5 3.5 0 0 1 0 6.8M17 14.7a4 4 0 0 1 4 4V20"/></svg></span>{incoming.length > 0 && <span className="nav-badge">{incoming.length > 99 ? "99+" : incoming.length}</span>}<span className="nav-label">{tr("Friends")}</span>
        </button>
        <button aria-current={tab === "Settings" ? "page" : undefined} className={tab === "Settings" ? "nav-item active" : "nav-item"} onClick={() => { setTab("Settings"); setShowMobileChat(false); }}>
          <span className="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1.5 -1.5) scale(1.12)"/></svg></span><span className="nav-label">{tr("Settings")}</span>
        </button>
      </nav>
      <section className={`cx-conversation ${showMobileChat ? "show-mobile" : ""}`}>
        {selectedGroup && tab === "Messages" ? <>
          <header className="conversation-head"><button className="back-btn" onClick={() => setShowMobileChat(false)}>‹</button><button type="button" className="profile-open-avatar" onClick={() => void openGroupProfile()} aria-label="Open group info"><span className="avatar">♧</span></button><button type="button" className="person profile-open-name" onClick={() => void openGroupProfile()}><strong>{selectedGroup.name}</strong><small>Tap for group info</small></button><div className="call-actions"><button type="button" className="call-icon" onClick={() => void openGroupProfile()} aria-label="Group info">ⓘ</button><div className="chat-more-wrap"><button type="button" className="call-icon" aria-label="More group chat options" onClick={() => setGroupChatMenuOpen(v=>!v)}>⋮</button>{groupChatMenuOpen && <div className="chat-more-menu"><button type="button" onClick={() => {const t=groupMessages.map(m=>(m.sender_id===userId?"You":(profiles.find(p=>p.id===m.sender_id)?displayName(profiles.find(p=>p.id===m.sender_id)!):"Member"))+": "+m.content).join("\n");void navigator.clipboard.writeText(t).then(()=>setNotice("Group chat copied.")).catch(()=>setError("Clipboard access failed."));setGroupChatMenuOpen(false);}}>▣ Copy group chat</button><button type="button" onClick={() => {const t=groupMessages.map(m=>(m.sender_id===userId?"You":(profiles.find(p=>p.id===m.sender_id)?displayName(profiles.find(p=>p.id===m.sender_id)!):"Member"))+": "+m.content).join("\n");const u=URL.createObjectURL(new Blob([t],{type:"text/plain"}));const a=document.createElement("a");a.href=u;a.download="ConnectX-group-chat.txt";a.click();URL.revokeObjectURL(u);setGroupChatMenuOpen(false);}}>↓ Export group chat</button><button type="button" onClick={() => {setGroupSelectionMode(true);setSelectedGroupMessageIds([]);setGroupChatMenuOpen(false);setNotice("Tap group messages to select them.");}}>☑ Select messages</button><button type="button" onClick={() => {setGroupFeedSelectionMode(true);setSelectedGroupFeedItems([]);setGroupChatMenuOpen(false);setNotice("Tap a poll or announcement card to select it.");}}>☑ Select polls & announcements</button><button type="button" onClick={() => {setGroupChatMenuOpen(false);void openGroupProfile();}}>ⓘ Group info</button></div>}</div></div></header>
          <div className="messages-area" ref={messagesAreaRef}>{groupFeedSelectionMode && <div className="bulk-actions"><strong>{selectedGroupFeedItems.length} posts selected</strong><button type="button" disabled={!selectedGroupFeedItems.length} onClick={()=>void deleteSelectedGroupFeedItems()}>Delete</button><button type="button" onClick={()=>{setGroupFeedSelectionMode(false);setSelectedGroupFeedItems([]);}}>Cancel</button></div>}{groupSelectionMode && <div className="bulk-actions"><strong>{selectedGroupMessageIds.length} selected</strong><button type="button" disabled={!selectedGroupMessageIds.length} onClick={async()=>{const chosen=groupMessages.filter(m=>selectedGroupMessageIds.includes(m.id)&&!m.deleted_for_everyone);if(!chosen.length){setNotice("Select at least one message.");return;}const isAdmin=groupMembers.some(member=>member.user_id===userId&&member.role==="admin");const allowed=chosen.filter(m=>m.sender_id===userId||isAdmin);if(!allowed.length){setNotice("You can delete your own messages. Group admins can also delete other members’ messages.");return;}if(!window.confirm("Delete "+allowed.length+" selected group message(s) for everyone?"))return;const ids=allowed.map(m=>m.id);const {data,error}=await supabase.rpc("connectx_delete_group_messages",{p_group_id:selectedGroup?.id,p_message_ids:ids});if(error){setError("Messages could not be deleted: "+error.message);return;}if(Number(data)!==ids.length){setError("Only "+Number(data||0)+" of "+ids.length+" messages were deleted. Refresh the group and try again.");return;}setGroupMessages(old=>old.map(m=>ids.includes(m.id)?{...m,deleted_for_everyone:true}:m));setSelectedGroupMessageIds([]);setGroupSelectionMode(false);setNotice(ids.length+" group message(s) deleted.");}}>Delete</button><button type="button" onClick={async()=>{const chosen=groupMessages.filter(m=>selectedGroupMessageIds.includes(m.id));try{await navigator.clipboard.writeText(chosen.map(m=>(m.sender_id===userId?"You":"Member")+": "+m.content).join("\n"));setNotice(chosen.length+" group message(s) copied.");setGroupSelectionMode(false);setSelectedGroupMessageIds([]);}catch{setError("Could not copy selected messages.");}}} disabled={!selectedGroupMessageIds.length}>Copy</button><button type="button" onClick={()=>{setGroupSelectionMode(false);setSelectedGroupMessageIds([]);}}>Cancel</button></div>}<div className="today">GROUP MESSAGES</div>{groupAnnouncements.map(a=>{const key="announcement:"+a.id;const selected=selectedGroupFeedItems.includes(key);return <article className={"group-feed-card"+(selected?" message-selected":"")} key={"announcement-"+a.id} onClick={()=>{if(groupFeedSelectionMode)setSelectedGroupFeedItems(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);}}><strong>📢 Announcement</strong><p>{a.content}</p><small>{profiles.find(p=>p.id===a.author_id)?displayName(profiles.find(p=>p.id===a.author_id)!):"Group admin"} · {timeLabel(a.created_at)}</small></article>})}{groupPolls.map(p=>{const total=p.options.reduce((sum,o)=>sum+o.votes,0);const expanded=expandedGroupPolls.includes(p.id);const key="poll:"+p.id;const selected=selectedGroupFeedItems.includes(key);return <article className={"group-feed-card whatsapp-poll-card"+(selected?" message-selected":"")} key={"poll-"+p.id} onClick={e=>{if(groupFeedSelectionMode&&!((e.target as HTMLElement).closest("button")))setSelectedGroupFeedItems(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);}}><div className="whatsapp-poll-question">{p.question}</div><div className="whatsapp-poll-mode"><span>✓</span>{p.is_closed?"Poll ended":p.allow_multiple_answers?"Select all that apply":"Select one"}</div><div className="whatsapp-poll-options">{p.options.map(o=>{const percent=total?Math.round(o.votes/total*100):0;return <button type="button" key={o.id} disabled={p.is_closed||groupVoteBusyIds.includes(p.id)} className={o.voted?"whatsapp-poll-option selected":"whatsapp-poll-option"} onClick={()=>void voteGroupPoll(p.id,o.id)}><span className="whatsapp-poll-choice">{o.voted?"✓":""}</span><span className="whatsapp-poll-option-main"><span className="whatsapp-poll-option-top"><span>{o.label}</span><span className="whatsapp-poll-count">{o.votes}</span></span><span className="whatsapp-poll-track"><span style={{width:percent+"%"}} /></span></span></button>})}</div><div className="whatsapp-poll-time">{timeLabel(p.created_at)}</div>{(p.created_by===userId||groupMembers.some(member=>member.user_id===userId&&member.role==="admin"))&&<button type="button" className="whatsapp-poll-view danger-option" onClick={()=>void deleteGroupPoll(p.id)}>Delete poll</button>}<button type="button" className="whatsapp-poll-view" onClick={()=>setExpandedGroupPolls(current=>current.includes(p.id)?current.filter(id=>id!==p.id):[...current,p.id])}>{expanded?"Hide votes":"View votes"}</button>{expanded&&<div className="whatsapp-poll-breakdown">{p.options.map(o=><div key={o.id}><span>{o.label}</span><strong>{o.votes} vote{o.votes===1?"":"s"} · {total?Math.round(o.votes/total*100):0}%</strong></div>)}<small>{total} total vote{total===1?"":"s"}{p.hide_voter_names?" · Voter names are hidden":""}</small></div>}</article>})}{groupMessages.filter((m) => !m.deleted_for_everyone).map((m) => <div key={m.id} className={(m.sender_id === userId ? "message-line mine" : "message-line")+(selectedGroupMessageIds.includes(m.id)?" message-selected":"")} onClick={()=>{if(groupSelectionMode){setSelectedGroupMessageIds(old=>old.includes(m.id)?old.filter(id=>id!==m.id):[...old,m.id]);}}} onTouchStart={(e) => {if(!groupSelectionMode)startReplySwipe(e, m, "group");}} onTouchEnd={(e) => {if(!groupSelectionMode)finishReplySwipe(e, m, "group");}}><div className={m.sender_id === userId ? "bubble mine-bubble" : "bubble"}>{m.reply_to_content && <div className="reply-quote"><strong>{m.reply_to_sender_id === userId ? "You" : "Replied message"}</strong><span>{m.reply_to_content}</span></div>}{editingGroupMessageId === m.id && m.sender_id === userId ? <div className="message-edit-inline"><textarea rows={3} maxLength={5000} value={editGroupMessageDraft} onChange={(event) => setEditGroupMessageDraft(event.target.value)} aria-label="Edit group message" /><div><button type="button" disabled={!editGroupMessageDraft.trim() || editGroupMessageBusy} onClick={() => void saveEditedGroupMessage(m)}>{editGroupMessageBusy ? "Saving…" : "Save"}</button><button type="button" onClick={() => { setEditingGroupMessageId(null); setEditGroupMessageDraft(""); }}>Cancel</button></div></div> : <p>{m.content}</p>}<small>{m.sender_id === userId ? "You · " : "Member · "}{m.edited_at ? "Edited · " : ""}{timeLabel(m.created_at)}</small>{m.sender_id === userId && !m.deleted_for_everyone && <div className="message-quick-actions" style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}><button type="button" style={{fontSize:12}} onClick={() => { setEditingGroupMessageId(m.id); setEditGroupMessageDraft(m.content); }}>Edit</button></div>}</div></div>)}{groupMessages.length === 0 && <div className="cx-empty-chat group-empty"><div className="cx-empty-art" aria-hidden="true"><span className="cx-empty-orbit orbit-one"/><span className="cx-empty-orbit orbit-two"/><span className="cx-empty-bubble">✦</span><span className="cx-empty-dot dot-one"/><span className="cx-empty-dot dot-two"/></div><strong>No messages yet</strong><p>Say hi to the group and get things going.</p><span className="cx-empty-hint">Your group conversation starts here</span></div>}</div>
          {showGroupTools && <div className="group-action-backdrop" onClick={()=>{setShowGroupTools(false);setGroupToolTab(null);}}><section className="group-tools-panel" role="dialog" aria-modal="true" aria-label="Group actions" onClick={e=>e.stopPropagation()}><div className="group-tools-panel-head"><div><strong>{groupToolTab==="announcement"?"New announcement":groupToolTab==="poll"?"Create a poll":"Group actions"}</strong><small>{groupToolTab?"Share something with everyone in this group":"Choose what you want to post"}</small></div><button type="button" aria-label="Close group actions" onClick={()=>{setShowGroupTools(false);setGroupToolTab(null);}}>×</button></div>{!groupToolTab && <div className="group-tools-tabs"><button type="button" onClick={()=>setGroupToolTab("announcement")} disabled={groupMembers.find(m=>m.user_id===userId)?.role!=="admin"}><span>📢</span><strong>Announcement</strong><small>Important message for members</small></button><button type="button" onClick={()=>setGroupToolTab("poll")}><span>📊</span><strong>Poll</strong><small>Ask members to vote</small></button></div>}{groupToolTab==="announcement" && <div className="group-tool-editor"><label>Announcement message</label><textarea rows={4} maxLength={2000} value={announcementDraft} onChange={e=>setAnnouncementDraft(e.target.value)} placeholder="Write your announcement…" /><button type="button" className="action-btn" disabled={!announcementDraft.trim()||groupPostBusy} onClick={()=>void postGroupAnnouncement()}>{groupPostBusy?"Posting…":"Post announcement"}</button></div>}{groupToolTab==="poll" && <div className="group-tool-editor poll-editor">
<label htmlFor="group-poll-question">Question</label><input id="group-poll-question" autoFocus value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} maxLength={255} placeholder="Ask a question" /><small className="poll-counter">{pollQuestion.length}/255</small>
<label>Options <small>2–10 options</small></label><div className="poll-option-fields">{pollOptionsDraft.map((option,index)=><div className="poll-option-row" key={index}><input aria-label={"Option "+(index+1)} value={option} maxLength={100} onChange={e=>setPollOptionsDraft(current=>current.map((item,i)=>i===index?e.target.value:item))} placeholder={"Option "+(index+1)} />{pollOptionsDraft.length>2&&<button type="button" className="poll-remove-option" aria-label={"Remove option "+(index+1)} onClick={()=>setPollOptionsDraft(current=>current.filter((_,i)=>i!==index))}>×</button>}</div>)}</div>
{pollOptionsDraft.length<10&&<button type="button" className="poll-add-option" onClick={()=>setPollOptionsDraft(current=>[...current,""])}>＋ Add option</button>}
<div className="poll-setting-row"><span>Allow multiple answers</span><input type="checkbox" checked={pollAllowMultipleAnswers} onChange={e=>setPollAllowMultipleAnswers(e.target.checked)} /></div><div className="poll-setting-row"><span>Hide voter names</span><input type="checkbox" checked={pollHideVoterNames} onChange={e=>setPollHideVoterNames(e.target.checked)} /></div>
<button type="button" className="action-btn poll-send-btn" disabled={!pollQuestion.trim()||pollOptionsDraft.filter(x=>x.trim()).length<2||groupPostBusy} onClick={()=>void createGroupPoll()}>{groupPostBusy?"Sending…":"➤ Send poll"}</button></div>}</section></div>}<form className="composer group-composer" onSubmit={sendGroupMessage}>{replyTarget?.kind === "group" && <div className="reply-compose"><span><strong>Replying to {replyTarget.sender_id === userId ? "yourself" : "message"}</strong><small>{replyTarget.content}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}<button type="button" className="group-more-btn" aria-label="More group actions" onClick={()=>{setShowGroupTools(v=>!v);setGroupToolTab(null);}}>⋮</button><textarea className="composer-textarea" rows={1} value={groupDraft} onChange={(e) => { setGroupDraft(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, window.innerHeight * 0.35)}px`; }} placeholder="Message the group…" maxLength={5000} aria-label="Group message" /><button className="send" disabled={!groupDraft.trim() || busy}>➤</button></form>
        </> : selectedFriend && tab === "Messages" ? <>
          <header className="conversation-head">
            <button className="back-btn" onClick={() => setShowMobileChat(false)}>‹</button>
            <button type="button" className="profile-open-avatar" aria-label={"View " + activeName + "'s profile"} onClick={() => void openFriendProfile()}>
              {selectedFriend.avatar_url ? <img className="avatar chat-header-avatar" src={selectedFriend.avatar_url} alt="" /> : <span className="avatar chat-header-avatar">{initials(activeName)}</span>}
            </button>
            <button type="button" className="person profile-open-name" onClick={() => void openFriendProfile()} aria-label={"View " + activeName + "'s profile"}><strong>{activeName}</strong><small>View profile</small></button>
            <div className="call-actions">
              <button type="button" className="call-icon" title="Audio call" aria-label="Start audio call" disabled={!!activeCall || !!incomingCall} onClick={() => { void startCall("audio"); }}>☎</button>
              <button type="button" className="call-icon" title="Video call" aria-label="Start video call" disabled={!!activeCall || !!incomingCall} onClick={() => { void startCall("video"); }}>▣</button>
              <div className="chat-more-wrap"><button type="button" className="call-icon" aria-label="More chat options" onClick={() => setChatMenuOpen(v=>!v)}>⋮</button>
                {chatMenuOpen && <div className="chat-more-menu">
                  <button className="danger-option" disabled={blockActionBusy} onClick={() => void toggleBlockSelected()}>{blockActionBusy ? "Updating…" : blockedWithSelected ? "↗ Unblock user" : "⊘ Block user"}</button>
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
          {callFeedback && <p className="call-inline-feedback" role="alert">{callFeedback}</p>}
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
              return <div key={message.id} className={(mine ? "message-line mine" : "message-line") + (selectedMessageIds.includes(message.id) ? " message-selected" : "") + (message.id.startsWith("optimistic-") ? " message-sending" : "")} onClick={() => { if (messageSelectionMode) toggleMessageSelection(message.id); }} onTouchStart={(e) => { if (!messageSelectionMode) startReplySwipe(e, message, "direct"); }} onTouchEnd={(e) => { if (!messageSelectionMode) finishReplySwipe(e, message, "direct"); }}>
                <div className={mine ? "bubble mine-bubble" : "bubble"} style={{background:mine?activeChatTheme.mine:activeChatTheme.theirs,color:chatTheme===6?"#f4f2ff":"#25233a"}}>{message.reply_to_content && <div className="reply-quote"><strong>{message.reply_to_content.startsWith("STATUS_REPLY|") ? "Replied to your status" : message.reply_to_content.startsWith("STATUS_REACTION|") ? "Reacted to your status" : message.reply_to_sender_id === userId ? "You" : "Replied message"}</strong><span>{message.reply_to_content.replace(/^STATUS_(?:REPLY|REACTION)\|/, "")}</span></div>}{message.message_type === "voice" ? <VoiceMessagePlayer src={message.content} mine={mine} /> : message.message_type === "image" ? (mediaIsExpired || !message.media_url ? <p className="expired-media">This photo has expired.</p> : <img className="chat-media" src={message.media_url} alt="Shared photo" />) : message.message_type === "video" ? (mediaIsExpired || !message.media_url ? <p className="expired-media">This video has expired.</p> : <video className="chat-media" src={message.media_url} controls playsInline preload="metadata" />) : (editingMessageId === message.id && mine ? null : <p>{message.content}</p>)}
                  {editingMessageId === message.id && mine && message.message_type === "text" && <div className="message-edit-inline"><textarea rows={3} maxLength={5000} value={editMessageDraft} onChange={(event) => setEditMessageDraft(event.target.value)} aria-label="Edit message" /><div><button type="button" disabled={!editMessageDraft.trim() || editMessageBusy} onClick={() => void saveEditedMessage(message)}>{editMessageBusy ? "Saving…" : "Save"}</button><button type="button" onClick={() => { setEditingMessageId(null); setEditMessageDraft(""); }}>Cancel</button></div></div>}
                  <small>{message.edited_at ? "Edited · " : ""}{timeLabel(message.created_at)} {mine ? (message.read_at ? <span className="read-ticks">✓✓</span> : "✓") : ""}</small>
                  {reactions.filter((item) => item.message_id === message.id).map((item) => <button key={item.id} className="reaction-chip" onClick={() => toggleReaction(message.id, item.emoji)}>{item.emoji}{item.user_id === userId ? " · you" : ""}</button>)}
                  {reactionMessage === message.id && <div className="reaction-picker">{["👍","❤️","😂","😮","😢","🔥"].map((emoji) => <button key={emoji} onClick={() => toggleReaction(message.id, emoji)}>{emoji}</button>)}</div>}
                  <button className="react-trigger" onClick={() => setReactionMessage(reactionMessage === message.id ? null : message.id)} aria-label="React to message">☺</button>
                  <div className="message-quick-actions" style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}><button type="button" style={{fontSize:12}} onClick={() => void copyMessage(message)}>Copy</button>{mine && message.message_type === "text" && !message.id.startsWith("optimistic-") && <button type="button" style={{fontSize:12}} onClick={() => { setError(""); setNotice(""); setEditingMessageId(message.id); setEditMessageDraft(message.content); }}>Edit</button>}<button type="button" style={{fontSize:12}} onClick={() => setReplyTarget({kind:"direct",id:message.id,content:message.content,sender_id:message.sender_id})}>Reply</button></div>
                </div>
              </div>;
            })}
            {messages.length === 0 && <div className="cx-empty-chat"><div className="cx-empty-art" aria-hidden="true"><span className="cx-empty-orbit orbit-one"/><span className="cx-empty-orbit orbit-two"/><span className="cx-empty-bubble">✦</span><span className="cx-empty-dot dot-one"/><span className="cx-empty-dot dot-two"/></div><strong>No messages yet</strong><p>Say hi and make the first move.</p><span className="cx-empty-hint">Your conversation starts here</span></div>}
          </div>
          {blockedWithSelected ? <div className="blocked-chat-notice" role="status"><strong>Messaging is blocked</strong><span>You or this user has blocked the other. Unblock to send messages again.</span></div> : <form className="composer composer-modern" onSubmit={sendMessage}>
            {replyTarget?.kind === "direct" && <div className="reply-compose"><span><strong>Replying to {replyTarget.sender_id === userId ? "yourself" : activeName}</strong><small>{replyTarget.content}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}
            <input ref={attachmentInputRef} className="attachment-input" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={!!voiceBlob||recording} onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) return;
              if (file.size > 20 * 1024 * 1024) { setError("The maximum photo/video size is 20 MB."); event.target.value = ""; return; }
              if (!["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(file.type)) { setError("Choose a JPG, PNG, WEBP image or MP4 video."); event.target.value = ""; return; }
              setError(""); setAttachment(file);
            }} />
            <div className="composer-main-row">
              <button type="button" className="attach-btn" aria-label="Attach photo or video" disabled={recording||!!voiceBlob} onClick={()=>attachmentInputRef.current?.click()}>＋</button>
              {recording ? <div className="recording-strip">
                <span className="recording-live-dot"/><strong>{Math.floor(recordingSeconds/60)}:{String(recordingSeconds%60).padStart(2,"0")}</strong>
                <span className="recording-hint">{recordingLocked?"Recording locked · tap stop when finished":"Slide up to lock · slide left to cancel"}</span>
                {recordingLocked && <><button type="button" className="recording-cancel" onClick={cancelVoiceRecording} aria-label="Cancel voice recording">×</button><button type="button" className="recording-stop" onClick={()=>{voiceLockedRef.current=false;setRecordingLocked(false);stopVoiceRecording();}} aria-label="Stop voice recording">■</button></>}
              </div> : <div className="composer-input-wrap">
                <textarea className="composer-textarea" rows={1} value={draft} onChange={(e) => { setDraft(e.target.value); void broadcastTyping(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, window.innerHeight * 0.35)}px`; }} placeholder={attachment ? "Add a caption (optional)…" : "Write a message…"} maxLength={5000} aria-label="Message" />
                <button type="button" className="composer-inline-icon" aria-label="Insert emoji" onClick={()=>setDraft(current=>current+"😊")}>☺</button>
                <button type="button" className="composer-inline-icon" aria-label="Attach photo or video" onClick={()=>attachmentInputRef.current?.click()}>⌁</button>
              </div>}
              {draft.trim()||attachment ? <button type="submit" className="composer-send-btn" disabled={busy||!selectedFriend||!userId} aria-label="Send message">{busy?"…":"➤"}</button> : voiceBlob ? <span className="voice-ready-indicator">Voice ready</span> : <button type="button" className="mic-btn" disabled={busy||!!voiceBlob||!!attachment} onPointerDown={handleVoicePointerDown} onPointerMove={handleVoicePointerMove} onPointerUp={handleVoicePointerUp} onPointerCancel={handleVoicePointerCancel} aria-label="Hold to record a voice message">🎙</button>}
            </div>
            {attachment && <div className="attachment-preview">
              {attachment.type.startsWith("image/") ? <img src={attachmentPreview} alt="Selected attachment preview" /> : <video src={attachmentPreview} muted playsInline />}
              <span>{attachment.name}</span>
              <button type="button" aria-label="Remove attachment" onClick={() => { setAttachment(null); if (attachmentInputRef.current) attachmentInputRef.current.value = ""; }}>×</button>
            </div>}
            {voiceBlob && <div className="voice-preview"><audio controls src={voicePreview} /><button type="button" onClick={()=>{setVoiceBlob(null);URL.revokeObjectURL(voicePreview);setVoicePreview("");}}>×</button><button type="button" disabled={busy} onClick={()=>void sendVoiceMessage()}>Send voice</button></div>}
          </form>}
        </> : <div className="empty-state">{tab === "Friends" ? "Find people and build your friends list." : "Choose a friend to start messaging."}</div>}
      </section>

      {groupProfileOpen && selectedGroup && <div className="profile-modal-backdrop group-profile-backdrop" onClick={() => setGroupProfileOpen(false)}>
        <section className="friend-profile-card group-profile-card" role="dialog" aria-modal="true" aria-label="Group info" onClick={event => event.stopPropagation()}>
          <header className="friend-profile-topbar"><button type="button" onClick={() => setGroupProfileOpen(false)} aria-label="Back">‹</button><strong>Group info</strong><span className="group-info-header-spacer" /></header>
          <div className="group-profile-hero">
             <div className="group-profile-avatar">{selectedGroup.avatar_url ? <img src={selectedGroup.avatar_url} alt={selectedGroup.name + " group photo"} /> : <span>{initials(selectedGroup.name)}</span>}</div>
             <h2>{selectedGroup.name}</h2><p>{groupMembers.length} participants</p><small>Created {new Date(selectedGroup.created_at).toLocaleDateString()}</small>
             {groupMembers.some(member => member.user_id === userId && member.role === "admin") && <>
               <input ref={groupAvatarInputRef} className="group-avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadGroupAvatar(file); }} />
               <button type="button" className="group-photo-change-btn" disabled={groupAvatarBusy} onClick={() => groupAvatarInputRef.current?.click()}>{groupAvatarBusy ? "Uploading photo…" : "Change group photo"}</button>
             </>}
           </div>
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
              <button type="button" onClick={() => { setFriendProfile(null); void chooseFriend(friendProfile); }}><span>▣</span>Message</button>
              {acceptedIds.has(friendProfile.id) ? <>
                <button type="button" onClick={() => { setFriendProfile(null); void startCall("audio"); }}><span>☎</span>Audio</button>
                <button type="button" onClick={() => { setFriendProfile(null); void startCall("video"); }}><span>▣</span>Video</button>
              </> : (() => {
                const relation = requests.find((r) =>
                  (r.sender_id === userId && r.receiver_id === friendProfile.id) ||
                  (r.sender_id === friendProfile.id && r.receiver_id === userId)
                );
                const outgoingPending = relation?.status === "pending" && relation.sender_id === userId;
                const incomingPending = relation?.status === "pending" && relation.receiver_id === userId;
                const isSending = requestSendingProfileId === friendProfile.id;
                const isPending = outgoingPending || pendingRequestProfileIds.includes(friendProfile.id);
                if (isPending) return <button type="button" className="friend-request-pending" disabled><span className="request-pending-icon" aria-hidden="true">✓</span>Pending<i className="request-pending-ripple" aria-hidden="true" /></button>;
                if (incomingPending) return <button type="button" className="friend-request-pending" disabled>Request received</button>;
                return <button type="button" disabled={isSending} onClick={() => void sendRequest(friendProfile)}><span className={isSending ? "request-send-spinner" : ""}>{isSending ? "Sending…" : "＋ Add friend"}</span></button>;
              })()}
            </div>
          </div>
          <div className="friend-profile-section">
            <small>ABOUT</small>
            <p>{loadingFriendProfile ? "Loading…" : friendProfile.bio?.trim() || "Hey there! I am using ConnectX."}</p>
            {friendProfile.show_last_seen === false && <span className="friend-profile-note">Last seen is hidden</span>}
          </div>
          <div className="friend-profile-section friend-profile-disappearing">
             <small>DISAPPEARING MESSAGES</small>
             <p>New messages in this chat disappear after the selected time. This applies to both people.</p>
             <div className="disappearing-options">
               {[{hours:0,label:"Off"},{hours:24,label:"24 hours"},{hours:168,label:"7 days"},{hours:720,label:"30 days"}].map(option => <button key={option.hours} type="button" disabled={disappearingBusy || loadingFriendProfile} className={disappearingHours === option.hours ? "active" : ""} onClick={() => void saveDisappearingSetting(option.hours)}>{option.label}</button>)}
             </div>
             <span className="disappearing-status">{disappearingBusy ? "Saving setting…" : disappearingHours ? `Currently: ${disappearingHours === 24 ? "24 hours" : disappearingHours === 168 ? "7 days" : "30 days"}` : "Currently off"}</span>
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

      {intelligenceOpen && <div className="intelligence-backdrop" role="dialog" aria-modal="true" aria-label="ConnectX Intelligence" onClick={() => setIntelligenceOpen(false)}>
        <section className="intelligence-panel" onClick={(event)=>event.stopPropagation()}>
          <header className="intelligence-head">
            <div className="intelligence-brand"><span className="intelligence-orb large">✦</span><span><strong>ConnectX Intelligence</strong><small>Your private AI workspace</small></span></div>
            <div className="intelligence-head-actions"><button type="button" onClick={()=>setIntelligenceTurns([])} aria-label="New conversation" title="New conversation">＋</button><button type="button" onClick={()=>setIntelligenceOpen(false)} aria-label="Close intelligence">×</button></div>
          </header>
          <div className="intelligence-context">
            <label><input type="checkbox" checked={intelligenceUseContext} onChange={(event)=>setIntelligenceUseContext(event.target.checked)}/> Use current conversation context</label>
            <span>{intelligenceUseContext?(selectedGroup?"Group · "+selectedGroup.name:selectedFriend?"Chat · "+displayName(selectedFriend):"No chat selected"):"Context off"}</span>
          </div>
          <div className="intelligence-thread" ref={intelligenceScrollRef}>
            {intelligenceTurns.length===0 ? <div className="intelligence-welcome"><div className="intelligence-welcome-orb">✦</div><h2>Think beyond the chat.</h2><p>Ask questions, find decisions, turn conversations into action, and get clear answers from your chats.</p><div className="intelligence-suggestions">
              <button type="button" onClick={()=>void askConnectXIntelligence("Summarize the current conversation. Highlight decisions, open questions and next steps.","summarize")}>✧ Summarize chat</button>
              <button type="button" onClick={()=>void askConnectXIntelligence("Extract all action items and deadlines from this conversation. Do not guess missing details.","tasks")}>✓ Find action items</button>
              <button type="button" onClick={()=>void askConnectXIntelligence("What decisions have been made in this conversation? Include evidence from messages.","decisions")}>◈ Find decisions</button>
              <button type="button" onClick={()=>void askConnectXIntelligence("Draft a helpful, natural reply based on the current conversation. Do not send it.","draft")}>↗ Draft a reply</button>
              <button type="button" onClick={()=>void askConnectXIntelligence("Create a concise timeline of important dates, plans and deadlines mentioned here.","timeline")}>◷ Build a timeline</button>
              <button type="button" onClick={()=>void askConnectXIntelligence("Identify unresolved questions, blockers and risks in this conversation.","insights")}>⌁ Spot blockers</button>
            </div></div> : <div className="intelligence-messages">{intelligenceTurns.map((turn)=><article key={turn.id} className={"intelligence-message "+turn.role}><span>{turn.role==="assistant"?"✦ ConnectX Intelligence":"You"}</span><p>{turn.content}</p></article>)}</div>}
            {intelligenceBusy&&<div className="intelligence-thinking"><i/><i/><i/> Thinking through it…</div>}
            {intelligenceError&&<div className="intelligence-error" role="alert">{intelligenceError}</div>}
          </div>
          <form className="intelligence-composer" onSubmit={(event)=>{event.preventDefault();void askConnectXIntelligence();}}>
            <textarea value={intelligenceInput} onChange={(event)=>setIntelligenceInput(event.target.value)} placeholder="Ask ConnectX anything…" rows={1} maxLength={3000}/>
            <button type="submit" disabled={!intelligenceInput.trim()||intelligenceBusy} aria-label="Send to ConnectX Intelligence">➤</button>
          </form>
          <p className="intelligence-disclaimer">Free on-device-style tools; no external AI API. Uses recent chat context only when the context switch is on. Results are rule-based, not generative AI.</p>
        </section>
      </div>}

      <style jsx>{`
        * { box-sizing:border-box; }
        .friend-profile-actions .friend-request-pending{position:relative;overflow:hidden;border:1px solid #4b9d83;background:#15392f;color:#8ff0c5;animation:request-pending-glow 1.8s ease-in-out infinite}
        .friend-profile-actions .friend-request-pending:disabled{opacity:1;cursor:default}
        .request-pending-btn{position:relative;display:inline-flex;align-items:center;gap:6px;overflow:hidden;border:1px solid #4b9d83!important;background:#15392f!important;color:#8ff0c5!important;cursor:default!important;animation:request-pending-glow 1.8s ease-in-out infinite}
        .request-pending-icon{display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#27b77e;color:#08251b;font-size:11px;font-weight:900;animation:request-check-pop .35s cubic-bezier(.2,1.5,.5,1) both}
        .request-pending-ripple{position:absolute;inset:0;border-radius:inherit;pointer-events:none;animation:request-ripple 1.8s ease-out infinite}
        .request-send-spinner{display:inline-flex;align-items:center;gap:6px}
        .request-send-spinner:before{content:"";width:11px;height:11px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:connectx-refresh-spin .65s linear infinite}
        @keyframes request-pending-glow{50%{box-shadow:0 0 0 3px #27b77e22}}
        @keyframes request-check-pop{from{opacity:0;transform:scale(.35)}to{opacity:1;transform:scale(1)}}
        @keyframes request-ripple{0%{box-shadow:inset 0 0 0 0 #62e6b233}70%,100%{box-shadow:inset 0 0 0 18px #62e6b200}}
        @media(prefers-reduced-motion:reduce){.request-pending-btn,.request-pending-icon,.request-pending-ripple,.request-send-spinner:before{animation:none!important}}
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
        .cx-chats { flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0 9px calc(24px + env(safe-area-inset-bottom)); }
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
         .blocked-chat-notice{display:flex;flex-direction:column;gap:5px;margin:0;padding:15px 18px calc(15px + env(safe-area-inset-bottom));border-top:1px solid #49333d;background:#241923;color:#ffe4e8;font-size:13px}.blocked-chat-notice span{color:#d8b9c0;font-size:12px;line-height:1.45}.chat-more-wrap{position:relative}.chat-more-menu{position:absolute;right:0;top:44px;z-index:25;width:220px;padding:6px;border:1px solid #39445e;border-radius:13px;background:#171f32;box-shadow:0 14px 38px #0008}.chat-more-menu button{display:block;width:100%;padding:11px 10px;border:0;border-radius:8px;background:transparent;color:#edf0fa;text-align:left;font-size:12px}.chat-more-menu button:hover{background:#2b3450}.chat-more-menu .danger-option{color:#ff9aa8}.chat-theme-panel{padding:12px 14px;background:#191b2b;border-bottom:1px solid #35334a;color:#f4f2ff}.chat-theme-heading{display:flex;justify-content:space-between;align-items:center;font-size:13px}.chat-theme-heading button,.chat-search-bar button{border:0;background:transparent;color:inherit;font-size:20px}.chat-theme-carousel{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:12px 2px 8px;touch-action:pan-x}.chat-theme-choice{flex:0 0 86px;display:flex;flex-direction:column;gap:6px;align-items:center;border:2px solid transparent;border-radius:10px;background:transparent;color:#e8e7f2;padding:5px;scroll-snap-align:center}.chat-theme-choice.chosen{border-color:#a99aff}.theme-preview{width:72px;height:54px;padding:6px;display:flex;flex-direction:column;gap:4px;border-radius:8px}.theme-preview i{width:35px;height:9px;border-radius:8px}.theme-preview i:nth-child(2){align-self:flex-end}.chat-theme-choice small{font-size:10px}.chat-search-bar{display:flex;align-items:center;gap:9px;padding:9px 13px;background:#20202d;color:#eeeaf8}.chat-search-bar input{flex:1;min-width:0;padding:9px;border:1px solid #414157;border-radius:8px;background:#11111b;color:inherit}.chat-search-bar small{white-space:nowrap;color:#aaa4bd;font-size:10px}.call-inline-feedback { margin: 6px 14px; padding: 9px 12px; border: 1px solid #d97757; border-radius: 10px; color: #b5472d; background: rgba(217,119,87,.09); font-size: 12px; overflow-wrap: anywhere; }
        .call-actions { display:flex;gap:8px;margin-left:auto; }.call-icon { width:36px;height:36px;border:1px solid #3b4560;border-radius:11px;background:#202a40;color:#d9d2ff;font-size:17px;cursor:pointer; }.call-icon:disabled { opacity:.4;cursor:not-allowed; }
        .call-overlay { position:fixed;z-index:20;inset:0;display:grid;place-items:center;padding:18px;background:#050914dd;backdrop-filter:blur(8px); }.incoming-card,.active-call-card { width:min(100%,520px);border:1px solid #3a4562;border-radius:22px;background:#151f33;color:#f5f6fc;box-shadow:0 24px 80px #0009;overflow:hidden; }.incoming-card { padding:34px 24px;text-align:center; }.call-avatar { width:82px;height:82px;margin:10px auto 20px;display:grid;place-items:center;border-radius:50%;background:#6257b5;color:white;font-size:36px; }.incoming-card h2 { margin:0;font-size:20px; }.incoming-card p { color:#9ca8c0;font-size:13px; }.incoming-actions,.call-controls { display:flex;justify-content:center;gap:12px;margin-top:26px; }.incoming-actions button,.call-controls button { padding:12px 18px;border:0;border-radius:12px;background:#303b53;color:#fff;font-weight:700; }.accept-call { background:#23875e!important; }.decline-call,.hangup { background:#b83c55!important; }.active-call-card { padding:18px; }.call-topline { display:flex;justify-content:space-between;gap:12px;align-items:center;padding:4px 4px 14px;font-size:13px; }.call-topline span { color:#9da9c0;font-size:11px; }.video-stage { position:relative;height:min(58vh,420px);min-height:230px;border-radius:15px;overflow:hidden;background:#070b14; }.remote-video { width:100%;height:100%;object-fit:cover; }.local-video { position:absolute;right:12px;bottom:12px;width:26%;max-height:35%;aspect-ratio:3/4;object-fit:cover;border:2px solid #fff;border-radius:12px;background:#202a40; }.video-placeholder { position:absolute;inset:0;display:grid;place-items:center;color:#aab5ca;font-size:12px;pointer-events:none; }.audio-stage { min-height:260px;display:grid;align-content:center;text-align:center;color:#aab5ca; }.audio-stage .call-avatar { margin-bottom:4px; }.audio-stage p { font-size:12px; }.call-controls { margin:18px 0 4px;flex-wrap:wrap; }.call-controls .control-on { background:#6557c7; }
        .read-ticks { color:#54b9ff;font-weight:900;letter-spacing:-3px;padding-right:3px; }.reaction-chip { margin:6px 4px 0 0;padding:4px 7px;border:1px solid #56617b;border-radius:12px;background:#27344d;color:white;font-size:11px; }.reaction-picker { display:flex;gap:4px;margin-top:7px;padding:5px;background:#101a2c;border:1px solid #45516d;border-radius:20px;width:max-content; }.reaction-picker button,.react-trigger { border:0;background:transparent;color:white;font-size:17px;cursor:pointer; }.react-trigger { display:block;margin-left:auto;font-size:13px;color:#b8c3d9; }.typing-indicator { align-self:flex-start;color:#aeb9d0;font-size:11px;display:flex;align-items:center;gap:4px; }.typing-indicator span { width:5px;height:5px;border-radius:50%;background:#a99aff;animation:typingPulse .8s infinite alternate; }.typing-indicator span:nth-child(2) { animation-delay:.2s; }.typing-indicator span:nth-child(3) { animation-delay:.4s; } @keyframes typingPulse { to { opacity:.25;transform:translateY(-3px); } }.bulk-actions { display:flex;align-items:center;gap:6px;padding:8px;position:sticky;top:0;background:#121a2b;z-index:2; }.bulk-actions strong { flex:1;font-size:11px; }.bulk-actions button { border:1px solid #46516b;border-radius:8px;padding:6px;background:#202a40;color:#fff;font-size:10px; }.chat-row.chat-selected { outline:2px solid #8e80ff;background:#28264a; }
        .back-btn { display:none;border:0;background:transparent;color:#c9bfff;font-size:28px; }.empty-state { margin:auto;color:#8490a9;text-align:center;padding:20px; }
         .groups-heading { display:flex;align-items:center;justify-content:space-between;padding:16px 12px 8px;color:#817b91;font-size:11px;font-weight:700;letter-spacing:1px; }.group-row { display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;margin-bottom:7px;border:1px solid #eeeaff;border-radius:13px;background:#faf9ff;color:#30245a;text-align:left; }.group-avatar { display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#eeeaff;color:#7659dc;font-size:20px; }.group-empty { padding:4px 12px 12px;color:#918aa4;font-size:11px; }
         .group-tiles-section{margin:9px 0 13px;padding:12px 11px 10px;border:1px solid #2b293d;border-radius:18px;background:linear-gradient(145deg,#171622,#11111b);overflow:hidden}
         .group-tiles-heading{display:flex;align-items:center;justify-content:space-between;margin:0 2px 9px;color:#aaa2c8;font-size:10px;letter-spacing:1.2px;font-weight:800}
         .group-tiles-heading>strong span{color:#8e86a9}.group-tiles-heading>button{border:0;background:transparent;color:#b6a6ff;font:inherit;font-size:11px;letter-spacing:0;cursor:pointer;padding:3px 4px}
         .group-tiles-row{display:flex;gap:10px;overflow-x:auto;padding:1px 1px 5px;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x}.group-tiles-row::-webkit-scrollbar{display:none}
         .group-tile{flex:0 0 66px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0;border:0;background:transparent;color:#e9e4ff;cursor:pointer}
         .group-tile-avatar{width:60px;height:60px;display:grid;place-items:center;overflow:hidden;border-radius:17px;background:#7154ed;color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px}
         .group-tile:nth-of-type(3n+1) .group-tile-avatar{background:#129b8b}.group-tile:nth-of-type(3n+2) .group-tile-avatar{background:#d64e83}
         .group-tile-avatar img{width:100%;height:100%;object-fit:cover}.group-tile>strong{width:100%;overflow:hidden;color:#c9c1e5;font-size:10px;font-weight:600;text-align:center;text-overflow:ellipsis;white-space:nowrap}
         .group-tile-new .group-tile-avatar{border:2px dashed #7864c8;background:transparent;color:#b9a8ff;font-size:27px;font-weight:400}
         .group-tiles-section .group-empty{padding:0 2px 2px;margin:2px 0 0;font-size:10px}
         .group-profile-avatar img{width:100%;height:100%;border-radius:inherit;object-fit:cover}.group-profile-avatar span{display:grid;place-items:center;width:100%;height:100%}
         .group-avatar-file-input{display:none}.group-photo-change-btn{margin-top:8px;padding:8px 13px;border:1px solid #554a86;border-radius:20px;background:#28233e;color:#c9baff;font-size:11px;font-weight:700;cursor:pointer}.group-photo-change-btn:disabled{opacity:.6;cursor:wait}
        .section-caption { padding:14px 12px 7px;color:#77839c;font-size:9px;font-weight:800;letter-spacing:1.4px; }.request-caption { border-top:1px solid #263149;margin-top:12px; }
        .mini-btn { padding:8px 10px;font-size:10px;white-space:nowrap; }.muted-btn,.action-btn.secondary { background:#303b53;color:#d1d8e8; }
        .request-row { display:flex;align-items:center;gap:7px;padding:10px 12px;color:#dce2f2;font-size:11px; }.request-row span { flex:1; }.settings-panel.profile-editor{position:relative;isolation:isolate;gap:14px;padding:18px 16px 28px;background:linear-gradient(180deg,#19182b 0%,#12121d 48%,#11111a 100%);border:1px solid #29263e;border-radius:24px;box-shadow:0 18px 48px #0005;overflow:hidden}
.settings-panel.profile-editor:before{content:"";position:absolute;z-index:-1;top:-90px;right:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,#8265ff35,transparent 70%);pointer-events:none}
.settings-hero{display:flex;align-items:center;gap:14px;padding:19px 16px;margin:-2px -2px 8px;border:1px solid #49406d;border-radius:19px;background:linear-gradient(120deg,#342653,#20203a 65%,#29234a);text-align:left;box-shadow:inset 0 1px #ffffff12}
.settings-hero-icon{width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:16px;background:linear-gradient(145deg,#a68bff,#6e52d6);color:#fff;font-size:25px;box-shadow:0 7px 20px #8664ff55}
.settings-hero h2{margin:3px 0 2px;color:#fff;font-size:23px;letter-spacing:-.7px}.settings-hero p{margin:0;color:#c1b8dc;font-size:11px}.settings-eyebrow{color:#c4b5ff;font-size:9px;font-weight:800;letter-spacing:1.8px}.settings-hero-spark{margin-left:auto;color:#c7b8ff;font-size:24px}
.settings-section-title{display:flex;align-items:center;gap:9px;margin:12px 0 2px;color:#c9c2e4;font-size:10px;font-weight:850;letter-spacing:1.4px;text-align:left}.settings-section-title span{display:grid;place-items:center;width:23px;height:23px;border-radius:8px;background:#302849;color:#bba7ff;font-size:9px;letter-spacing:0}
.settings-panel .profile-photo-wrap{margin:4px 0 5px}.settings-panel .profile-photo,.settings-panel .large-avatar{width:82px;height:82px;border:3px solid #8d75ed;box-shadow:0 0 0 5px #8d75ed20,0 12px 25px #0005}
.settings-panel .profile-field{gap:7px;color:#d9d3eb;font-size:11px}.settings-panel .profile-field input,.settings-panel .profile-field textarea{border:1px solid #39344e;border-radius:13px;background:#191827;padding:13px 14px;color:#f8f6ff;transition:border-color .18s,box-shadow .18s}.settings-panel .profile-field input:focus,.settings-panel .profile-field textarea:focus{outline:none;border-color:#947aff;box-shadow:0 0 0 3px #9277ff20}
.settings-panel .privacy-option{min-height:62px;padding:13px 14px;border:1px solid #39334f;border-radius:15px;background:linear-gradient(120deg,#201d32,#191925);box-shadow:0 5px 16px #0002}.settings-panel .privacy-option strong{font-size:12px;color:#f4f0ff}.settings-panel .privacy-option small{font-size:10px;line-height:1.5;color:#a9a2bd}
.settings-panel .mini-btn{min-height:38px;padding:0 16px;border-radius:12px;background:linear-gradient(135deg,#a48aff,#7155dc);box-shadow:0 5px 15px #7658d744;font-size:11px}
.settings-panel .action-btn{min-height:47px;border-radius:14px;background:linear-gradient(110deg,#9b7cff,#7255db);box-shadow:0 8px 22px #7255db44;font-size:13px;letter-spacing:.2px}.settings-panel .action-btn.secondary{margin-top:0;border:1px solid #403a55;background:#211f30;box-shadow:none;color:#d5cbed}
.settings-panel .profile-hint{font-size:10px;line-height:1.5;color:#a19ab5;margin:0 2px}.settings-panel .privacy-option input{width:21px;height:21px;cursor:pointer;accent-color:#9b7cff}
.app-version-card{display:flex;align-items:center;gap:11px;margin:8px 0 4px;padding:12px;border:1px solid #302b43;border-radius:14px;background:linear-gradient(120deg,#1b1928,#15141f);text-align:left}
.app-version-mark{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border-radius:10px;background:#30264b;color:#c8b7ff;font-size:11px;font-weight:900;letter-spacing:-.5px}
.app-version-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.app-version-copy strong{color:#eee9ff;font-size:11px}.app-version-copy small{color:#9e97b2;font-size:9px;line-height:1.35}
.app-version-number{white-space:nowrap;color:#c2b3f8;font-size:10px;font-weight:750}
/* Compact settings layout */
        .settings-panel.profile-editor{padding:10px 14px calc(18px + env(safe-area-inset-bottom));gap:8px;border:0;border-radius:0;box-shadow:none;background:transparent;overflow:visible}
        .settings-panel.profile-editor:before{display:none}
        .settings-section-title{margin:8px 0 0;font-size:9px;gap:8px}
        .settings-section-title span{width:20px;height:20px;border-radius:6px}
        .settings-panel .profile-photo-wrap{margin:2px 0 4px}
        .settings-panel .profile-photo,.settings-panel .large-avatar{width:62px;height:62px;font-size:20px}
        .settings-panel .profile-field{gap:5px;font-size:11px}
        .settings-panel .profile-field input,.settings-panel .profile-field textarea{padding:10px 12px;border-radius:11px}
        .settings-panel .profile-field textarea{min-height:62px}
        .settings-panel .privacy-option{min-height:50px;padding:9px 11px;border-radius:12px}
        .settings-panel .privacy-option small{font-size:9px}
        .settings-panel .action-btn{min-height:42px}
        .settings-panel { padding:24px;text-align:center; }.large-avatar { width:76px;height:76px;margin:8px auto 14px;font-size:24px;border-radius:50%;display:grid;place-items:center;background:#29334b;color:#fff; }.profile-photo-wrap { display:flex;justify-content:center;margin:8px 0 18px; }.profile-photo { width:88px;height:88px;border-radius:50%;object-fit:cover;border:2px solid #56617b; }.profile-editor { text-align:left;display:flex;flex-direction:column;gap:10px; }.profile-field { display:flex;flex-direction:column;gap:6px;text-align:left;color:#cbd5e8;font-size:12px;font-weight:600; }.profile-field input,.profile-field textarea { width:100%;box-sizing:border-box;border:1px solid #35415a;border-radius:9px;background:#111a2b;color:#f3f6ff;padding:11px;font:inherit;font-weight:400; }.profile-field input[type=file] { font-size:11px; }.profile-field textarea { resize:vertical; }.profile-hint { color:#8290aa;font-size:10px;text-align:left;margin-top:-7px; }.privacy-heading { color:#9ca9c1;font-size:10px;letter-spacing:1px;text-align:left;margin-top:12px; }.privacy-option { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid #303b53;border-radius:10px;text-align:left; }.privacy-option span { display:flex;flex-direction:column;gap:4px; }.privacy-option strong { color:#e9eefb;font-size:12px; }.privacy-option small { color:#8b96ad;font-size:10px; }.privacy-option input { accent-color:#8e80ff;width:18px;height:18px; }.action-btn { padding:12px 18px;margin-top:12px; }.toast { position:fixed;z-index:5;bottom:22px;left:50%;transform:translateX(-50%);max-width:min(92vw,560px);display:flex;gap:14px;align-items:center;padding:12px 15px;border:1px solid #3b4a65;border-radius:12px;background:#1b2940;color:#dce6ff;font-size:12px;box-shadow:0 10px 40px #0008; }.toast button { border:0;background:transparent;color:white;font-size:18px; }.error-toast { border-color:#8a4250;background:#3a202c;color:#ffd2d9; }

        /* Smooth, lightweight message entrance and premium chat surfaces */
        .message-line{animation:cx-message-in 260ms cubic-bezier(.2,.75,.25,1) both;transform-origin:bottom}
        .message-line .bubble{transition:transform 180ms ease,box-shadow 220ms ease;will-change:transform}
        .message-line:active .bubble{transform:scale(.985)}
        .message-line.message-sending .bubble{animation:cx-send-pop 320ms cubic-bezier(.2,.9,.25,1) both}
        .message-line.message-sending .bubble:after{content:"Sending…";display:block;margin-top:5px;font-size:9px;opacity:.58;letter-spacing:.15px}
        .chat-row{position:relative;isolation:isolate;border:1px solid transparent;transition:transform 190ms ease,border-color 220ms ease,background 220ms ease,box-shadow 220ms ease}
        .chat-row.active{border-color:#a58aff88;background:linear-gradient(115deg,#f0eaff,#e9e2ff 58%,#f6f1ff);box-shadow:0 0 0 1px #9c7cff26,0 8px 26px #7954d52b,0 0 24px #9a78ff24}
        .cx-shell[data-theme="dark"] .chat-row.active{border-color:#9e83ff99;background:linear-gradient(115deg,#302744,#28223e 60%,#302747);box-shadow:0 0 0 1px #9d7aff2b,0 8px 28px #0005,0 0 28px #8b65ff30}
        .cx-empty-chat{display:flex;min-height:230px;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:22px 16px;text-align:center;animation:cx-message-in 350ms ease both}
        .cx-empty-chat strong{margin-top:4px;color:#34265e;font-size:15px;font-weight:700}
        .cx-empty-chat p{margin:0;color:#81799f;font-size:12px}
        .cx-empty-hint{margin-top:4px;color:#9a8bc7;font-size:10px;letter-spacing:.25px}
        .cx-empty-art{position:relative;width:126px;height:112px;margin-bottom:4px;display:grid;place-items:center}
        .cx-empty-orbit{position:absolute;border:1px solid #9879ff44;border-radius:50%;transform:rotate(-18deg)}
        .cx-empty-orbit.orbit-one{width:116px;height:66px}
        .cx-empty-orbit.orbit-two{width:92px;height:100px;transform:rotate(34deg)}
        .cx-empty-bubble{z-index:1;width:58px;height:58px;display:grid;place-items:center;border:1px solid #ffffff99;border-radius:20px;background:linear-gradient(145deg,#b29aff,#7755dc);box-shadow:0 10px 28px #7d5be355,0 0 28px #9e7cff55;color:white;font-size:25px;animation:cx-float 3.2s ease-in-out infinite}
        .cx-empty-dot{position:absolute;width:9px;height:9px;border-radius:50%;background:#a48aff;box-shadow:0 0 12px #9c7aff88}
        .cx-empty-dot.dot-one{top:13px;right:20px}.cx-empty-dot.dot-two{bottom:13px;left:18px;width:6px;height:6px}
        .cx-shell[data-theme="dark"] .cx-empty-chat strong{color:#f1edff}
        .cx-shell[data-theme="dark"] .cx-empty-chat p{color:#aaa4bd}
        @keyframes cx-message-in{from{opacity:0;transform:translateY(9px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes cx-send-pop{0%{transform:translateY(7px) scale(.96);opacity:.55}70%{transform:translateY(-1px) scale(1.01)}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes cx-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @media(prefers-reduced-motion:reduce){.message-line,.message-line.message-sending .bubble,.cx-empty-chat,.cx-empty-bubble{animation:none!important}.message-line .bubble,.chat-row{transition:none!important}}
.username-onboarding-backdrop{position:fixed;z-index:9999;inset:0;display:grid;place-items:center;padding:22px;background:rgba(9,8,18,.88);backdrop-filter:blur(18px)}
.username-onboarding{width:min(100%,420px);display:flex;flex-direction:column;gap:14px;padding:28px 23px;border:1px solid #5e4b8d;border-radius:25px;background:linear-gradient(155deg,#211b35,#12121e 72%);box-shadow:0 25px 90px #0009;color:#f7f3ff}
.username-onboarding-mark{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(140deg,#a98dff,#6547cf);font-weight:900}
.username-onboarding-kicker{margin:4px 0 -10px;color:#b7a5f4;font-size:9px;font-weight:850;letter-spacing:2px}.username-onboarding h1{margin:0;font-size:25px}.username-onboarding>p:not(.username-onboarding-kicker){margin:0;color:#b8b0ca;font-size:12px;line-height:1.55}
.username-onboarding-label{display:flex;flex-direction:column;gap:8px;color:#c8bce9;font-size:10px;font-weight:800;letter-spacing:1px}.username-onboarding-input{display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid #574a78;border-radius:13px;background:#171525}.username-onboarding-input span{color:#a78aff;font-size:17px}.username-onboarding-input input{width:100%;height:48px;border:0;outline:0;background:transparent;color:white;font-size:15px}.username-onboarding small{color:#958ba9;font-size:10px}.username-onboarding-error{margin:0;color:#ff9aab;font-size:11px}
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
          .mobile-nav.raised-nav { position:fixed;z-index:10;left:34px;right:34px;bottom:calc(9px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:0;padding:6px 5px 5px;border-radius:30px;background:#191824;border:1px solid #302d42;box-shadow:0 7px 20px #08071150;isolation:isolate;min-height:78px; }
          .raised-nav .nav-item { position:relative;z-index:1;min-width:0;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 2px;border:0;border-radius:22px;background:transparent;color:#9992b5;font-size:clamp(10px,3vw,13px);font-weight:500;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;overflow:visible; }
          .raised-nav .nav-icon { width:36px;height:36px;display:grid;place-items:center;position:relative;border-radius:50%;background:transparent;color:inherit;transition:width 180ms ease,height 180ms ease,margin 180ms ease,background 180ms ease,box-shadow 180ms ease; }
          .raised-nav .nav-icon svg { width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round; }
          .raised-nav .nav-icon .status-dot { fill:currentColor;stroke:none; }
          .raised-nav .nav-label { display:block;white-space:nowrap;line-height:1.15; }
          .raised-nav .nav-item.active { color:#c9baff;background:transparent; }
          .raised-nav .nav-item.active .nav-icon { width:52px;height:52px;margin-top:-19px;margin-bottom:0;background:#7955f5;color:#fff;border:4px solid #11101a;box-shadow:0 4px 0 #0e0d17,0 0 0 1px #3e365d; }
          .raised-nav .nav-item.active .nav-icon svg { width:29px;height:29px; }
          .raised-nav .nav-item.active .nav-label { color:#c9baff;font-size:clamp(10px,3vw,13px); }
          .raised-nav .nav-badge { position:absolute;top:4px;left:calc(50% + 6px);min-width:20px;height:20px;padding:0 5px;display:grid;place-items:center;border-radius:999px;background:#fa526d;color:#fff;font-size:10px;font-weight:700;line-height:1;box-shadow:0 2px 8px #0003; }
          .raised-nav .nav-item:active { transform:scale(.97); }
          .cx-shell[data-theme="light"] .mobile-nav.raised-nav,.cx-shell[data-theme="dark"] .mobile-nav.raised-nav { background:#191824;border-color:#302d42; }
          .cx-shell[data-theme="dark"] .raised-nav .nav-item { color:#9992b5; }
          .cx-shell[data-theme="dark"] .raised-nav .nav-item.active { color:#c9baff; }
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

        /* WhatsApp-style poll message card */
        .group-feed-card.whatsapp-poll-card{width:min(100%,510px);max-width:510px;margin:14px auto;padding:18px 18px 12px;border:0;border-radius:18px;background:#202a2d;color:#f4f6f6;box-shadow:0 2px 5px #0002}
        .whatsapp-poll-question{margin:0 0 14px;color:#f5f6f6;font-size:17px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}
        .whatsapp-poll-mode{display:flex;align-items:center;gap:8px;margin-bottom:16px;color:#aab4b7;font-size:13px}
        .whatsapp-poll-mode span{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:#657278;color:#202a2d;font-size:11px;font-weight:900}
        .whatsapp-poll-options{display:grid;gap:14px}
        .whatsapp-poll-option{display:flex;width:100%;align-items:center;gap:12px;padding:5px 0;border:0;background:transparent;color:#f4f6f6;text-align:left;cursor:pointer}
        .whatsapp-poll-option:disabled{cursor:default;opacity:1}
        .whatsapp-poll-choice{display:grid;place-items:center;width:35px;height:35px;flex:0 0 35px;border:3px solid #9ba5a8;border-radius:50%;color:#17372a;font-size:19px;font-weight:900}
        .whatsapp-poll-option.selected .whatsapp-poll-choice{border-color:#20bd68;background:#20bd68}
        .whatsapp-poll-option-main{display:grid;flex:1;min-width:0;gap:8px}
        .whatsapp-poll-option-top{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:16px;line-height:1.25}
        .whatsapp-poll-count{flex:0 0 auto;color:#f4f6f6;font-size:14px}
        .whatsapp-poll-track{display:block;width:100%;height:8px;overflow:hidden;border-radius:10px;background:#394246}
        .whatsapp-poll-track>span{display:block;height:100%;border-radius:10px;background:#20bd68;transition:width .2s ease}
        .whatsapp-poll-time{margin:14px 0 4px;color:#a6b0b3;font-size:12px;text-align:right}
        .whatsapp-poll-view{display:block;margin:14px auto 0;padding:8px 14px;border:0;background:transparent;color:#20bd68;font-size:16px;font-weight:650}
        .whatsapp-poll-breakdown{display:grid;gap:9px;margin-top:10px;padding:12px 0 2px;border-top:1px solid #394246}
        .whatsapp-poll-breakdown>div{display:flex;justify-content:space-between;gap:12px;color:#cbd2d4;font-size:12px}
        .whatsapp-poll-breakdown strong{color:#f3f5f5;font-weight:600;white-space:nowrap}
        .whatsapp-poll-breakdown small{color:#9da8ab;font-size:11px}
        @media(max-width:600px){.group-feed-card.whatsapp-poll-card{width:100%;max-width:100%;margin:12px 0;padding:17px 16px 11px;border-radius:18px}.whatsapp-poll-question{font-size:16px}.whatsapp-poll-option-top{font-size:15px}}

        /* ConnectX Intelligence — Meta AI-style launcher and assistant surface */
        .list-head-actions{display:flex;align-items:center;gap:12px}
        .intelligence-launcher{position:relative;display:flex;align-items:center;gap:6px;padding:5px 10px 5px 5px;border:1px solid #7868eb55;border-radius:24px;background:linear-gradient(135deg,#28234b,#17243a);color:#e9e5ff;cursor:pointer;box-shadow:0 4px 16px #5d4ac522}
        .intelligence-orb{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:conic-gradient(from 30deg,#8c78ff,#37d8c2,#5f91ff,#b37cff,#8c78ff);color:#fff;font-size:22px;box-shadow:0 0 14px #8d79ff66}
        .intelligence-launcher-label{font-size:11px;font-weight:800;letter-spacing:.3px}
        .intelligence-orb.large{width:42px;height:42px;flex:0 0 42px;font-size:26px}
        .intelligence-backdrop{position:fixed;z-index:1500;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:#050711b8;backdrop-filter:blur(12px)}
        .intelligence-panel{display:flex;width:min(100%,680px);height:min(820px,calc(100dvh - 36px));min-height:420px;flex-direction:column;overflow:hidden;border:1px solid #393654;border-radius:26px;background:#0e111b;color:#f4f2ff;box-shadow:0 30px 100px #000b}
        .intelligence-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 20px;border-bottom:1px solid #292a3a;background:linear-gradient(120deg,#17152b,#101d2a)}
        .intelligence-brand{display:flex;align-items:center;gap:12px;min-width:0}.intelligence-brand>span:last-child{display:grid;gap:4px}.intelligence-brand strong{font-size:15px}.intelligence-brand small{color:#9ca4b7;font-size:11px}
        .intelligence-head-actions{display:flex;gap:8px}.intelligence-head-actions button{width:36px;height:36px;border:1px solid #37374b;border-radius:50%;background:#202236;color:#e9e7f8;font-size:22px}
        .intelligence-context{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;border-bottom:1px solid #242637;background:#141725}
        .intelligence-context label{display:flex;align-items:center;gap:8px;color:#d5d6e5;font-size:11px}.intelligence-context input{accent-color:#8d79ff}.intelligence-context>span{max-width:48%;overflow:hidden;color:#9d9bb9;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
        .intelligence-thread{flex:1;min-height:0;overflow-y:auto;padding:20px}
        .intelligence-welcome{display:flex;min-height:100%;flex-direction:column;align-items:center;justify-content:center;text-align:center}
        .intelligence-welcome-orb{display:grid;place-items:center;width:72px;height:72px;margin-bottom:18px;border-radius:24px;background:conic-gradient(from 30deg,#8c78ff,#37d8c2,#5f91ff,#b37cff,#8c78ff);color:white;font-size:42px;box-shadow:0 0 45px #8d79ff44}
        .intelligence-welcome h2{margin:0;color:#f3f0ff;font-size:24px;letter-spacing:-.6px}.intelligence-welcome>p{max-width:390px;margin:9px 0 24px;color:#a4a7ba;font-size:13px;line-height:1.6}
        .intelligence-suggestions{display:grid;width:min(100%,490px);grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        .intelligence-suggestions button{min-height:52px;padding:10px 12px;border:1px solid #34364d;border-radius:14px;background:#171b2b;color:#dedcf1;text-align:left;font-size:11px;cursor:pointer;transition:border-color .15s,transform .15s}
        .intelligence-suggestions button:active{transform:scale(.98)}.intelligence-suggestions button:hover{border-color:#8b79ef}
        .intelligence-messages{display:grid;gap:16px}.intelligence-message{max-width:92%;padding:12px 14px;border:1px solid #303247;border-radius:16px;background:#171b2b}.intelligence-message.user{justify-self:end;border-color:#51458b;background:#282345}.intelligence-message>span{display:block;margin-bottom:7px;color:#a99bff;font-size:10px;font-weight:700}.intelligence-message p{margin:0;color:#e9e9f2;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}
        .intelligence-thinking{display:flex;align-items:center;gap:6px;margin-top:18px;color:#a6a3bd;font-size:11px}.intelligence-thinking i{width:6px;height:6px;border-radius:50%;background:#a99bff;animation:intelligence-pulse .9s infinite alternate}.intelligence-thinking i:nth-child(2){animation-delay:.2s}.intelligence-thinking i:nth-child(3){animation-delay:.4s}@keyframes intelligence-pulse{to{opacity:.25;transform:translateY(-3px)}}
        .intelligence-error{margin-top:14px;padding:10px 12px;border:1px solid #743e51;border-radius:12px;background:#351e2a;color:#ffb9c8;font-size:11px;line-height:1.5}
        .intelligence-composer{display:flex;align-items:flex-end;gap:10px;margin:0 16px;padding:9px 10px 9px 15px;border:1px solid #393950;border-radius:19px;background:#191c2b}
        .intelligence-composer textarea{flex:1;min-width:0;max-height:120px;resize:vertical;border:0;outline:0;background:transparent;color:#f4f2ff;font:inherit;font-size:13px;line-height:1.5}.intelligence-composer textarea::placeholder{color:#85879d}
        .intelligence-composer button{width:40px;height:40px;flex:0 0 40px;border:0;border-radius:13px;background:linear-gradient(135deg,#8d78f5,#6354cf);color:white;font-size:20px}.intelligence-composer button:disabled{opacity:.4}
        .intelligence-disclaimer{margin:9px 14px calc(10px + env(safe-area-inset-bottom));color:#74798e;font-size:9px;text-align:center;line-height:1.4}
        @media(max-width:700px){.list-head-actions{gap:10px}.intelligence-launcher{padding:4px 8px 4px 4px}.intelligence-orb{width:32px;height:32px;font-size:21px}.intelligence-backdrop{align-items:stretch;padding:0;background:#090b13}.intelligence-panel{width:100%;height:100dvh;min-height:0;border:0;border-radius:0;padding-bottom:env(safe-area-inset-bottom)}.intelligence-head{padding:calc(12px + env(safe-area-inset-top)) 15px 12px}.intelligence-thread{padding:17px 14px}.intelligence-welcome h2{font-size:22px}.intelligence-suggestions{gap:8px}.intelligence-suggestions button{min-height:54px;padding:9px;font-size:10px}.intelligence-context{padding:10px 14px}.intelligence-composer{margin:0 12px}.intelligence-disclaimer{margin-bottom:calc(9px + env(safe-area-inset-bottom))}}
        /* Voice notes: custom capsule player with live playback fill */
        .voice-message-player{display:flex;align-items:center;gap:10px;width:min(310px,72vw);min-width:205px;height:62px;padding:6px 12px 6px 7px;border:1px solid #514477;border-radius:999px;background:#28213f;color:#fff;overflow:hidden}
        .voice-message-player audio{display:none}
        .voice-play-button{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;border:0;border-radius:50%;background:#fff;color:#5d4ab7}
        .voice-play-button svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linejoin:round}
        .voice-pause-icon{font-size:22px;font-weight:800;line-height:1}
        .voice-wave-track{position:relative;display:flex;align-items:center;flex:1;min-width:0;height:48px;overflow:hidden;cursor:pointer}
        .voice-wave-fill{position:absolute;inset:0 auto 0 0;background:#7957f4;opacity:.95;pointer-events:none}
        .voice-wave-bars{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:3px;width:100%;height:100%;padding:0 1px;pointer-events:none}
        .voice-wave-bars span{display:block;flex:1;min-width:2px;max-width:4px;border-radius:5px;background:#fff}
        .voice-time{flex:0 0 auto;min-width:39px;text-align:right;color:#fff;font-size:14px;font-variant-numeric:tabular-nums}
        .bubble:not(.mine-bubble) .voice-message-player{border-color:#ded8ef;background:#eeeafd;color:#51447e}
        .bubble:not(.mine-bubble) .voice-play-button{background:#7654f5;color:#fff}
        .bubble:not(.mine-bubble) .voice-wave-bars span{background:#7765ad}
        .bubble:not(.mine-bubble) .voice-wave-fill{background:#d3c7ff}
        .bubble:not(.mine-bubble) .voice-time{color:#39324f}
        @media(max-width:700px){.voice-message-player{width:min(280px,68vw);min-width:190px;height:56px;gap:8px}.voice-play-button{width:44px;height:44px;flex-basis:44px}.voice-wave-track{height:44px}.voice-wave-bars{gap:2px}.voice-wave-bars span{max-width:3px}.voice-time{font-size:13px;min-width:36px}}
        /* Compact voice-first direct-message composer */
        .composer-modern{display:block!important;flex:0 0 auto!important;padding:12px 14px calc(12px + env(safe-area-inset-bottom))!important;border-top:1px solid #2a293a!important;background:#11111b!important}
        .composer-modern .reply-compose{margin-bottom:10px;background:#242238;color:#eeeaff;border-color:#8c78ff}
        .composer-main-row{display:flex;align-items:center;gap:10px;min-width:0}
        .composer-modern .attach-btn{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:0;border-radius:50%;background:#24243a;color:#c5b9ff;font-size:29px;font-weight:300;line-height:1}
        .composer-modern .attach-btn:disabled{opacity:.45}
        .composer-modern .attachment-input{display:none}
        .composer-input-wrap{display:flex;align-items:center;gap:7px;flex:1;min-width:0;min-height:48px;padding:0 10px 0 14px;border:1px solid #34334c;border-radius:28px;background:#222238;transition:border-color .16s,box-shadow .16s}
        .composer-input-wrap:focus-within{border-color:#8063f2;box-shadow:0 0 0 1px #8063f255}
        .composer-modern .composer-textarea{flex:1;min-width:0;width:0;min-height:44px;max-height:112px;margin:0;padding:11px 0;border:0!important;border-radius:0!important;outline:0;background:transparent!important;color:#f4f1ff!important;font-size:14px;line-height:1.35;resize:none;box-shadow:none!important}
        .composer-modern .composer-textarea::placeholder{color:#9290b0}
        .composer-inline-icon{display:grid;place-items:center;flex:0 0 28px;width:28px;height:34px;padding:0;border:0;background:transparent;color:#a9a2d0;font-size:22px}
        .composer-send-btn,.composer-modern .mic-btn{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;border:0;border-radius:50%;background:#7654f5;color:white;font-size:24px;line-height:1;box-shadow:0 4px 14px #7654f533}
        .composer-send-btn:disabled,.composer-modern .mic-btn:disabled{opacity:.45}
        .composer-modern .mic-btn{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
        .composer-modern .mic-btn:active{transform:scale(.96)}
        .recording-strip{display:flex;align-items:center;gap:9px;flex:1;min-width:0;min-height:48px;padding:0 10px 0 14px;border:1px solid #5a4050;border-radius:28px;background:#201b29;color:#f5efff}
        .recording-live-dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:#ff5277;box-shadow:0 0 0 4px #ff527722;animation:recording-pulse 1s infinite}
        .recording-strip strong{font-variant-numeric:tabular-nums;font-size:16px}
        .recording-hint{flex:1;min-width:0;overflow:hidden;color:#b0a8c9;font-size:11px;line-height:1.3}
        .recording-cancel,.recording-stop{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border:0;border-radius:50%;background:#343047;color:#d8ceff;font-size:20px}
        .recording-stop{background:#7654f5;color:#fff}
        .voice-ready-indicator{color:#b8aaff;font-size:11px}
        .composer-modern .attachment-preview{margin-top:9px;border-color:#38344e;background:#211f30;color:#e9e4ff}
        .composer-modern .voice-preview{position:static;display:flex;align-items:center;gap:8px;margin-top:9px;padding:8px;border-radius:16px;background:#222238}
        .composer-modern .voice-preview audio{flex:1;min-width:0;max-width:65%}
        .composer-modern .voice-preview button{min-height:34px;padding:0 11px;border:1px solid #51477b;border-radius:18px;background:#302b4b;color:#eeeaff;font-size:11px}
        @keyframes recording-pulse{50%{box-shadow:0 0 0 7px #ff527711;opacity:.75}}
        @media(max-width:700px){.composer-modern{padding:10px 12px calc(10px + env(safe-area-inset-bottom))!important}.composer-main-row{gap:9px}.composer-modern .attach-btn{width:42px;height:42px;flex-basis:42px}.composer-send-btn,.composer-modern .mic-btn{width:46px;height:46px;flex-basis:46px}.composer-input-wrap{min-height:46px;padding-left:13px}.composer-modern .composer-textarea{min-height:42px;font-size:14px}.recording-strip{min-height:46px;gap:7px;padding-left:11px}.recording-hint{font-size:10px}}
        .friend-profile-disappearing p{margin:7px 0 12px;color:#a9a4bd;font-size:12px;line-height:1.5}
        .disappearing-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .disappearing-options button{min-height:40px;padding:8px 10px;border:1px solid #48435e;border-radius:11px;background:#242238;color:#e8e3fa;font-size:12px;font-weight:650}
        .disappearing-options button.active{border-color:#8e78ff;background:#3a315f;color:#fff;box-shadow:inset 0 0 0 1px #8e78ff55}
        .disappearing-options button:disabled{opacity:.55}
        .disappearing-status{display:block;margin-top:9px;color:#a99bff;font-size:11px}
        .message-edit-inline{display:grid;gap:9px;width:min(100%,420px);margin:10px 0;padding:11px;border:1px solid #a99aff88;border-radius:13px;background:rgba(20,22,35,.07)}
        .message-edit-inline textarea{display:block;width:100%;min-height:88px;max-height:220px;resize:vertical;box-sizing:border-box;padding:11px 12px;border:1px solid #8c80bf;border-radius:10px;background:#fff;color:#242238;font:inherit;font-size:14px;line-height:1.45;outline:none}
        .message-edit-inline textarea:focus{border-color:#7967e8;box-shadow:0 0 0 3px #7967e822}
        .message-edit-inline>div{display:flex;justify-content:flex-end;gap:8px}
        .message-edit-inline button{min-height:36px;padding:7px 14px;border:1px solid #8b7be2;border-radius:9px;background:#7868eb;color:#fff;font-size:12px;font-weight:700}
        .message-edit-inline button:last-child{border-color:#a6a1b8;background:transparent;color:inherit}
        .message-edit-inline button:disabled{opacity:.45;cursor:not-allowed}
        /* Compact, page-attached mobile header */
        @media(max-width:700px){
          .cx-list:not(.hide-mobile) .list-head{
            position:sticky;top:0;z-index:40;box-sizing:border-box;width:100%;
            min-height:74px;padding:9px 14px 8px;gap:8px;margin:0;
            background:#11111a;border-bottom:1px solid #292638;
          }
          .cx-list .cx-brand{font-size:21px;line-height:1.05;font-weight:700;letter-spacing:-.8px;color:#f2efff}
          .cx-list .cx-brand span{font-size:25px;vertical-align:-2px;margin-right:6px;color:#8563f5}
          .cx-list .list-head p{margin-top:3px;font-size:11px;line-height:1.15;color:#aaa4bd}
          .cx-list .list-head-actions{gap:8px;flex-shrink:0}
          .cx-list .intelligence-launcher{height:40px;gap:7px;padding:3px 10px 3px 3px;border-radius:23px;background:#242337;border-color:#39344f;box-shadow:none}
          .cx-list .intelligence-orb{width:32px;height:32px;font-size:18px;background:#31cbb8;color:#172a37;box-shadow:none}
          .cx-list .intelligence-launcher-label{font-size:12px;font-weight:600}
          .cx-list .header-profile{position:relative;width:43px;height:43px;flex:0 0 43px;border:2px solid #a68cff;border-radius:50%;background:#8068e8;color:#fff;font-size:17px;box-shadow:0 0 0 2px #11111a}
          .cx-list .header-profile::after{content:"";position:absolute;width:10px;height:10px;right:-1px;bottom:0;border:2px solid #11111a;border-radius:50%;background:#32d6a1}
          .cx-list .header-profile img{width:100%;height:100%;object-fit:cover;border-radius:50%}
          .cx-list .search-row{position:sticky;top:74px;z-index:39;padding:7px 14px 8px;gap:0;margin:0;background:#11111a}
          .cx-list .search-row .search-box{height:46px;min-width:0;width:100%;flex:1;margin:0;padding:4px 5px 4px 13px;gap:8px;align-items:center;border:1px solid #37334e;border-radius:25px;background:#202033;color:#a49bbf;box-shadow:none}
          .cx-list .search-box .search-icon{font-size:22px;line-height:1;color:#a49bbf}
          .cx-list .search-box input{min-width:0;flex:1;color:#f4f0ff;font-size:13px}
          .cx-list .search-box input::placeholder{color:#928ba9;opacity:1}
          .cx-list .search-row .refresh-btn{width:38px;height:38px;min-width:38px;flex:0 0 38px;display:grid;place-items:center;margin:0;padding:0;border:0;border-radius:50%;background:#7955f5;color:#fff}
          .cx-list .search-row .refresh-btn span{font-size:23px;line-height:1;margin:0;display:block}
          .cx-list .search-row .refresh-btn:disabled{opacity:1;cursor:default}
          .cx-list .search-row .refresh-btn.is-refreshing span{animation:connectx-refresh-spin .7s linear infinite}
          @keyframes connectx-refresh-spin{to{transform:rotate(360deg)}}
        }
      `}</style>
    </main>
  );
}