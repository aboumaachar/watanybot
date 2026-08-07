export type WatanyChatMode = 'hybrid_system_search_ai' | 'social_user_group';
export type WatanyChatFamily = WatanyChatMode | 'related' | 'unknown';

export interface WatanyChatRouteOwner {
  readonly route: string;
  readonly family: WatanyChatFamily;
  readonly owner: string;
  readonly continuation?: boolean;
  readonly explicitSystemInvocationRequired?: boolean;
}

export interface WatanyChatApiOwner {
  readonly path: string;
  readonly family: WatanyChatFamily;
  readonly owner: string;
  readonly purpose: string;
}

export const WATANY_CHAT_ROUTES: readonly WatanyChatRouteOwner[] = [
  { route: '/hybrid-kb-chat', family: 'hybrid_system_search_ai', owner: 'Full-width hybrid KB continuation', continuation: true },
  { route: '/chat', family: 'hybrid_system_search_ai', owner: 'Official system chat continuation', continuation: true },
  { route: '/mobile-os/chat', family: 'hybrid_system_search_ai', owner: 'Redirect to official system chat', continuation: true },
  { route: '/saved', family: 'hybrid_system_search_ai', owner: 'Saved hybrid/system chats' },
  { route: '/chat-sessions', family: 'hybrid_system_search_ai', owner: 'Hybrid/system chat sessions' },
  { route: '/community', family: 'social_user_group', owner: 'Community landing', explicitSystemInvocationRequired: true },
  { route: '/groups', family: 'social_user_group', owner: 'Social group list', explicitSystemInvocationRequired: true },
  { route: '/groups/:groupId', family: 'social_user_group', owner: 'Social group thread', explicitSystemInvocationRequired: true },
  { route: '/messages', family: 'social_user_group', owner: 'User-to-user messages', explicitSystemInvocationRequired: true },
] as const;

export const WATANY_CHAT_APIS: readonly WatanyChatApiOwner[] = [
  { path: '/api/chat/hybrid', family: 'hybrid_system_search_ai', owner: 'Hybrid answer endpoint', purpose: 'final hybrid answer' },
  { path: '/api/kb/hybrid-chat', family: 'hybrid_system_search_ai', owner: 'Hybrid KB compatibility endpoint', purpose: 'hybrid answer compatibility' },
  { path: '/api/kb/live-search', family: 'hybrid_system_search_ai', owner: 'Typeahead/live search endpoint', purpose: 'candidate answers while typing' },
  { path: '/api/search/unified', family: 'hybrid_system_search_ai', owner: 'Global/app index search endpoint', purpose: 'app index and KB fallback' },
  { path: '/api/chat', family: 'hybrid_system_search_ai', owner: 'System chat endpoint', purpose: 'system chat continuation' },
  { path: '/api/chat/stream', family: 'hybrid_system_search_ai', owner: 'Streaming system chat endpoint', purpose: 'streaming system response' },
  { path: '/api/community/groups', family: 'social_user_group', owner: 'Social group list', purpose: 'group discovery' },
  { path: '/api/community/groups/:groupId/messages', family: 'social_user_group', owner: 'Social group messages', purpose: 'send and list group messages' },
  { path: '/api/community/groups/:groupId/read', family: 'social_user_group', owner: 'Social read receipts', purpose: 'mark/read state' },
  { path: '/api/community/groups/:groupId/typing', family: 'social_user_group', owner: 'Social typing status', purpose: 'typing indicator' },
  { path: '/api/admin/chat-sessions', family: 'hybrid_system_search_ai', owner: 'Admin hybrid chat session list', purpose: 'hybrid/session audit' },
  { path: '/api/admin/chat-messages', family: 'social_user_group', owner: 'Moderation for social/admin messages', purpose: 'message moderation' },
] as const;

export const WATANY_SOCIAL_SYSTEM_INVOCATION_ACTIONS = [
  'ask-watany',
  'ask-system',
  'mention-bot',
  'reply-to-system',
] as const;

function normalizePath(pathname: string): string {
  const value = String(pathname || '').split('?')[0].split('#')[0];
  if (value.length > 1 && value.endsWith('/')) return value.slice(0, -1);
  return value || '/';
}

export function getWatanyChatFamilyForRoute(pathname: string): WatanyChatFamily {
  const value = normalizePath(pathname);
  if (value === '/hybrid-kb-chat' || value === '/chat' || value === '/mobile-os/chat' || value === '/saved' || value === '/chat-sessions') {
    return 'hybrid_system_search_ai';
  }
  if (value === '/community' || value === '/groups' || value === '/messages' || value.startsWith('/groups/')) {
    return 'social_user_group';
  }
  return 'unknown';
}

export function isExplicitSocialSystemInvocation(action: string): boolean {
  const normalized = String(action || '').trim().toLowerCase();
  return WATANY_SOCIAL_SYSTEM_INVOCATION_ACTIONS.some((item) => item === normalized);
}

export function canSocialChatCallSystem(action: string): boolean {
  return isExplicitSocialSystemInvocation(action);
}

export function shouldAutoRunHybridInSocialChat(): false {
  return false;
}

export const WATANY_CHAT_BEHAVIOR_CONTRACT = Object.freeze({
  hybridMode: 'hybrid_system_search_ai' as WatanyChatMode,
  socialMode: 'social_user_group' as WatanyChatMode,
  hybridFlow: [
    'typeahead_current_page_first',
    'fallback_app_index_or_kb',
    'candidate_answers_before_send',
    'enter_opens_full_width_continuation',
    'session_context_continues',
  ] as const,
  socialFlow: [
    'user_to_user_messages',
    'group_messages',
    'reply_read_unread_typing',
    'media_placeholders_when_supported',
    'system_intervention_explicit_only',
  ] as const,
});
