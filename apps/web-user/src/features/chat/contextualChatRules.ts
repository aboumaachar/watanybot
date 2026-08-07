export type WatanyChatMode = 'hybrid' | 'social' | 'worldCup' | 'work';

export type ContextualChatRule = {
  id: string;
  pageContext: string;
  defaultMode: WatanyChatMode;
  searchScope: string[];
  promptBehavior: 'hidden_until_focus' | 'non_sticky' | 'always_visible';
};

export const contextualChatRules: ContextualChatRule[] = [
  {
    id: 'default-hybrid-contextual-chat',
    pageContext: 'default',
    defaultMode: 'hybrid',
    searchScope: ['current-page-items', 'database-text', 'kb-records'],
    promptBehavior: 'hidden_until_focus'
  },
  {
    id: 'procedures-contextual-chat',
    pageContext: 'procedures',
    defaultMode: 'hybrid',
    searchScope: ['procedure-index-tags', 'procedure-metadata', 'procedure-records', 'current-page-items'],
    promptBehavior: 'hidden_until_focus'
  },
  {
    id: 'world-cup-contextual-chat',
    pageContext: 'world-cup',
    defaultMode: 'hybrid',
    searchScope: ['world-cup-page-items', 'fixtures', 'teams', 'players', 'database-text'],
    promptBehavior: 'hidden_until_focus'
  },
  {
    id: 'social-chat-exception',
    pageContext: 'social',
    defaultMode: 'social',
    searchScope: ['social-thread', 'current-page-items'],
    promptBehavior: 'hidden_until_focus'
  },
  {
    id: 'work-chat-exception',
    pageContext: 'work',
    defaultMode: 'work',
    searchScope: ['work-item', 'current-page-items'],
    promptBehavior: 'hidden_until_focus'
  },
  {
    id: 'updates-contextual-chat',
    pageContext: 'updates',
    defaultMode: 'hybrid',
    searchScope: ['alerts', 'notifications', 'current-page-items', 'kb-records'],
    promptBehavior: 'hidden_until_focus'
  },
  {
    id: 'network-contextual-chat',
    pageContext: 'network',
    defaultMode: 'hybrid',
    searchScope: ['network-membership', 'network-guidance', 'current-page-items', 'kb-records'],
    promptBehavior: 'hidden_until_focus'
  }
];

export default contextualChatRules;