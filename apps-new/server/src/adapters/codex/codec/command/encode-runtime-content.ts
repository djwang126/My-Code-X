import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeContentItem } from '../../../../ports/index.js';
import { cleanJsonObject, nullToUndefined } from './clean-json-object.js';

export function encodeRuntimeContent(content: readonly RuntimeContentItem[], fallbackText: string): readonly JsonValue[] {
  if (!content.length) {
    return [{ type: 'text', text: fallbackText, text_elements: [] }];
  }

  return content.map(item => {
    switch (item.kind) {
      case 'text':
        return cleanJsonObject({
          type: 'text',
          text: item.text || fallbackText,
          text_elements: mapTextElements(item.textElements),
        });

      case 'image':
        return cleanJsonObject({
          type: 'localImage',
          path: item.imagePath,
        });

      case 'remote-image':
        return cleanJsonObject({
          type: 'image',
          url: item.imageUrl,
        });

      case 'skill':
        return cleanJsonObject({
          type: 'skill',
          name: item.name,
          path: item.path,
        });

      case 'mention':
        return cleanJsonObject({
          type: 'mention',
          name: item.name,
          path: item.path,
        });
    }
  });
}

function mapTextElements(textElements: readonly { readonly byteRange: { readonly start: number; readonly end: number }; readonly placeholder: string | null }[] | undefined): readonly JsonValue[] {
  if (!textElements?.length) {
    return [];
  }

  return textElements.map(element => cleanJsonObject({
    byteRange: cleanJsonObject({
      start: element.byteRange.start,
      end: element.byteRange.end,
    }),
    placeholder: nullToUndefined(element.placeholder),
  }));
}
