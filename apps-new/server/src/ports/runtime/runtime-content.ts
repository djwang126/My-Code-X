export type RuntimeContentItem =
  | RuntimeTextContentItem
  | RuntimeLocalImageContentItem
  | RuntimeRemoteImageContentItem
  | RuntimeSkillContentItem
  | RuntimeMentionContentItem;

export interface RuntimeTextContentItem {
  readonly kind: 'text';
  readonly text: string;
  readonly textElements?: readonly RuntimeTextElement[];
}

export interface RuntimeTextElement {
  readonly byteRange: RuntimeByteRange;
  readonly placeholder: string | null;
}

export interface RuntimeByteRange {
  readonly start: number;
  readonly end: number;
}

export interface RuntimeLocalImageContentItem {
  readonly kind: 'image';
  readonly imagePath: string;
}

export interface RuntimeRemoteImageContentItem {
  readonly kind: 'remote-image';
  readonly imageUrl: string;
}

export interface RuntimeSkillContentItem {
  readonly kind: 'skill';
  readonly name: string;
  readonly path: string;
}

export interface RuntimeMentionContentItem {
  readonly kind: 'mention';
  readonly name: string;
  readonly path: string;
}
