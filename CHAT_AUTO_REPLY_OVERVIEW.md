# Chat Auto-Reply Fix — Overview

## What was done
The dashboard chat file (`website/stitch_omniadmin_management_dashboard/integrated_chat/code.html`) was already a minimal text-and-photo chat, not the earlier AdminPro dashboard. The previously added auto-reply logic did not apply to the current file, so nothing was visible.

This fix adds the auto-reply directly into the current minimal chat:
- A dedicated banner sits between the chat header and the message thread.
- It shows immediately on chat open with the bot/system message.
- It is visually distinct from user and counterpart messages.
- It disappears smoothly after the support representative sends their first message.
- Normal sending and receiving continue to work normally.

## Auto-reply copy
> Hello! Thanks for contacting our support team. Please describe your issue or question in as much detail as possible so we can assist you effectively. A representative will respond shortly.

## Visual treatment
- Robot avatar (`smart_toy` icon).
- Sender: **Support Assistant**.
- Badge: **AUTO-REPLY**.
- Light-blue tinted banner with a blue left accent border.
- Clearly different from the user's primary-blue bubble and the counterpart's gray bubble.

## Dismissal behavior
- The banner is removed only when the support agent (the local user) sends a reply.
- Until then, it remains visible on every chat open.
- It does not interfere with typing, sending, or incoming replies.

## Verification
- Inline JavaScript syntax validated with `new Function`.
- Headless Chrome screenshot confirms the banner appears on chat open.
- Headless Chrome screenshot after simulated send confirms the banner disappears and the chat thread still works.
