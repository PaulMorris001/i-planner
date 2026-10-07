import { escapeHtml, page } from './authEmailHtml';
import type { NoteRole } from '../constants/collaboration';

// One line of plain text: control characters and line breaks become spaces, runs of spaces
// collapse, and it is cut to `max` characters. Applied to every user-supplied value that goes
// into an email (names, titles), so none of them can inject lines or headers or bloat the message.
export function flattenText(value: string, max: number): string {
  const flat = value.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '\u2026' : flat;
}

const ROLE_PHRASE: Record<NoteRole, string> = {
  editor: 'view and edit',
  viewer: 'view',
};

// Everything user-supplied here (the inviter's name, the note's title) goes through
// escapeHtml: a note title is free text and ends up inside an email that other people open.
export function buildCollabInviteEmailHtml(input: {
  inviterLabel: string;
  noteTitle: string;
  role: NoteRole;
  // The public invitation page (backend/src/routes/inviteWeb.routes.ts).
  inviteUrl: string;
  expiresInDays: number;
}): { subject: string; html: string; text: string } {
  const inviter = flattenText(input.inviterLabel, 60) || 'Someone';
  const title = flattenText(input.noteTitle, 80) || 'Untitled note';
  const phrase = ROLE_PHRASE[input.role];
  // The inviter's name is user-chosen text, so it is kept out of the subject line's tone and
  // length (an unbounded name could otherwise be used to write a misleading subject).
  const subject = `${inviter.slice(0, 40)} invited you to a note on i-Planner`;
  const html = page(
    `<h1 style="font-size:22px;margin:0 0 12px;">You've been invited to a note</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px;"><strong>${escapeHtml(inviter)}</strong> invited you to ${phrase} the note:</p>
    <p style="font-size:17px;font-weight:700;line-height:1.4;margin:0 0 20px;padding:12px 14px;background:#F7F7FB;border-radius:12px;">${escapeHtml(title)}</p>
    <a href="${escapeHtml(input.inviteUrl)}" style="display:block;text-align:center;background:#3B82F6;color:#fff;font-weight:700;text-decoration:none;padding:14px;border-radius:999px;font-size:15px;">View invitation</a>
    <p style="font-size:13px;line-height:1.6;color:#6B6A80;margin:16px 0 0;">You can accept or decline on the next page. This invitation expires in ${input.expiresInDays} days. If you don't know ${escapeHtml(inviter)}, you can ignore this email and nothing will happen.</p>`
  );
  const text =
    `${inviter} invited you to ${phrase} the note "${title}" on i-Planner.\n\n` +
    `View the invitation (you can accept or decline there): ${input.inviteUrl}\n\n` +
    `This invitation expires in ${input.expiresInDays} days. If you don't know ${inviter}, you can ignore this email.`;
  return { subject, html, text };
}
