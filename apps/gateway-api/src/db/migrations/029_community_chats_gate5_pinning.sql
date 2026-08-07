-- 029_community_chats_gate5_pinning.sql
-- Gate 5 pinning authority: extend immutable message events for pin/unpin actions.

ALTER TABLE community_message_events
  DROP CONSTRAINT IF EXISTS community_message_events_event_type_check;

ALTER TABLE community_message_events
  ADD CONSTRAINT community_message_events_event_type_check
  CHECK (event_type IN (
    'created',
    'edited',
    'deleted_for_everyone',
    'announcement',
    'reaction_added',
    'reaction_removed',
    'deleted_for_self',
    'pinned',
    'unpinned'
  ));