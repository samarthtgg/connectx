import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | ConnectX",
  description: "How ConnectX handles account, profile, messaging, media, call, and device data.",
};

const supportEmail = "kumbharsamarth1724@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#101018] px-6 py-12 text-white">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-violet-300 hover:text-violet-200">← Back to ConnectX</Link>
        <p className="mt-8 text-sm font-semibold tracking-[0.2em] text-violet-300">CONNECTX</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-400">Effective date: 26 November 2026</p>

        <div className="mt-8 space-y-8 leading-7 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Scope and service providers</h2>
            <p className="mt-2">This policy describes the data handling visible in the ConnectX application code reviewed for this release. ConnectX uses Supabase for authentication, database, file storage, and realtime features, and Vercel to host and deliver the application. Those providers may process technical information, such as service and request logs, under their own terms and policies.</p>
            <p className="mt-2">This is a description of the implementation reviewed, not a guarantee that every backend setting, provider log, or deployment configuration has been independently audited.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Information ConnectX handles</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li><strong className="text-white">Account data:</strong> your email address and Supabase authentication user identifier. Supabase Auth handles password authentication; the application uses the authenticated account identifier.</li>
              <li><strong className="text-white">Profile data:</strong> username, display name, biography, profile photo URL, private-profile preference, and last-seen preference.</li>
              <li><strong className="text-white">Connections:</strong> friend requests and their status, blocked-user relationships, and close-friend selections.</li>
              <li><strong className="text-white">Messages:</strong> direct and group message text, sender and recipient or group identifiers, timestamps, read/edit/reply information, reactions, and message-expiry settings. Scheduled messages include their content and scheduled time.</li>
              <li><strong className="text-white">Groups:</strong> group names and descriptions, group membership and roles, group images, announcements, polls, options, and votes.</li>
              <li><strong className="text-white">Status updates:</strong> captions, media references, media type, audience selection, creation and expiry times, views, and reactions.</li>
              <li><strong className="text-white">Voice and video calls:</strong> call participants, call type and status, WebRTC offer/answer information, and connection candidates. When you start a call, the browser may request access to your microphone and, for video, your camera.</li>
              <li><strong className="text-white">Location sharing:</strong> when you use the live-location feature, location information is handled for that feature and associated with its sharing record.</li>
              <li><strong className="text-white">Device-side preferences:</strong> language, theme, muted chats, chat themes, and chat-lock-related settings are stored in browser local storage on the device.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Files and media</h2>
            <p className="mt-2">The reviewed Supabase project currently has four buckets: `connectx-avatars`, `connectx-status-media`, `connectx-temporary-chat-media`, and `connectx-voice-notes`. The deployed Storage policies make avatar, status-media, and voice-note objects publicly readable. Anyone who obtains a file URL may be able to view that file; do not upload sensitive material as an avatar, status, or voice note. Temporary direct-chat photo/video storage is configured as private, with authenticated access policies tied to the relevant message or group membership.</p>
            <p className="mt-2">The temporary-media cleanup job is configured to run every minute, and recent production logs show repeated successful HTTP 200 responses from the cleanup Edge Function. This confirms the scheduled function is being invoked successfully, but the HTTP status alone does not prove that every expired file was deleted. The five-minute expiry is the intended retention window, not a guarantee of deletion at the exact five-minute mark. Status rows expire after 24 hours in the current schema, but automatic deletion of their underlying storage files was not verified. Voice-note storage is publicly readable and no automatic file-deletion schedule was verified for it. Avatar files remain until replaced or deleted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. How information is used and shared</h2>
            <p className="mt-2">ConnectX uses this information to authenticate accounts, display profiles, deliver messages and group features, manage friend relationships, show status updates, support calls and live-location sharing, remember preferences, and operate and secure the service.</p>
            <p className="mt-2">Information is processed by Supabase and Vercel as service providers. Content is also made available to the people or groups you choose to communicate or share with, according to the relevant feature and its access controls. The reviewed application code did not show an external advertising or analytics SDK; this does not rule out technical logging by the hosting or backend providers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Retention and deletion</h2>
            <p className="mt-2">Retention depends on the type of data and the deployed backend configuration. Some messages and statuses include expiry fields, and live-location access has database logic intended to restrict access after a friendship ends. An expiry field or access restriction does not by itself prove that the corresponding database row or stored file has been permanently deleted.</p>
            <p className="mt-2">The reviewed application code did not show a complete in-app account-deletion workflow. It also did not establish automatic deletion schedules for all status media, voice notes, call records, or expired location rows. For a privacy or deletion request, contact the address below. We will review the request and explain what can be done; this policy does not promise that every item can currently be deleted automatically or immediately.</p>
            <p className="mt-2">Device-side preferences remain in local storage until cleared by the app, browser, or device user. Removing the app or clearing browser data may remove those local settings, but does not delete server-side account data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Security</h2>
            <p className="mt-2">ConnectX relies on Supabase authentication, database and Storage access controls, and encrypted network connections provided by the hosting and backend services. The app includes access-control logic for some features, but this policy does not claim that every table, bucket, integration, or deployment setting has passed an independent security audit. No internet service can guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Your choices and requests</h2>
            <p className="mt-2">You can edit supported profile and privacy preferences in the app, choose the audience for supported status updates, manage connections, and control microphone or camera permissions through your device or browser. You can contact us to ask about personal data, request correction or deletion, or report a privacy concern. We may need to verify account ownership before acting on a request.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Changes to this policy</h2>
            <p className="mt-2">This policy may be updated when ConnectX features or data practices change. The effective date at the top indicates the latest revision published here. Material changes should be reviewed before continuing to use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Contact</h2>
            <p className="mt-2">For support, privacy questions, or data requests, email <a className="text-violet-300 underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
          </section>
        </div>

        <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-slate-500">
          <Link href="/about" className="text-violet-300 hover:text-violet-200">About ConnectX</Link>
          <span className="px-2">·</span>
          <a href={`mailto:${supportEmail}`} className="text-violet-300 hover:text-violet-200">Support</a>
        </footer>
      </article>
    </main>
  );
}
