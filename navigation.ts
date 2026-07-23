// Route names and their params, in one place so screens get type-checked
// navigation calls (`navigation.navigate('JobDetail', { id })`).
import type { JobPost, Member } from './types';

export type RootStackParamList = {
  Tabs: undefined;
  // Passing whole objects as params is normally discouraged, but this app
  // has no store — the alternative is refetching a member/post we already
  // have in hand. Fine at this size; revisit if params grow.
  MemberDetail: { member: Member };
  JobDetail: { id: string };
  // No `post` = create. With `post` = edit that post.
  JobCompose: { post?: JobPost } | undefined;
  JobApplicants: { id: string; title: string };
  JobRefer: { id: string; authorId: string };
};

export type TabParamList = {
  Directory: undefined;
  Jobs: undefined;
  Match: undefined;
  Discover: undefined;
  Profile: undefined;
};
