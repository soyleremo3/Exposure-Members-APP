// Route names and their params, in one place so screens get type-checked
// navigation calls (`navigation.navigate('MemberDetail', { member })`).
//
// The Job Board is a single self-contained screen (list, compose, apply,
// refer and applicants all expand in place, like the website), so it has no
// push routes of its own — only MemberDetail is pushed, from the directory
// and from a match.
import type { Member } from './types';

export type RootStackParamList = {
  Tabs: undefined;
  // Passing the whole Member as a param is normally discouraged, but this app
  // has no store — the alternative is refetching someone we already have in
  // hand. Fine at this size; revisit if params grow.
  MemberDetail: { member: Member };
};

export type TabParamList = {
  Directory: undefined;
  Jobs: undefined;
  Match: undefined;
  Discover: undefined;
  Profile: undefined;
};
