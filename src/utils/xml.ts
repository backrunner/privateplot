/**
 * XML validation utilities
 */
export class XMLValidator {
  /**
   * Validates if the XML string is well-formed
   * @param xml The XML string to validate
   * @param options Optional validation options
   * @returns True if the XML is valid, false otherwise
   */
  public static isValid(
    xml: string,
    options: {
      rootElement?: string;
      requiredElements?: string[];
      logPrefix?: string;
    } = {}
  ): boolean {
    const {
      rootElement,
      requiredElements = [],
      logPrefix = 'XML'
    } = options;

    try {
      // Basic structure validation
      if (!xml || typeof xml !== 'string') {
        console.error(`Invalid ${logPrefix}: Not a string`);
        return false;
      }

      // Check if it starts with XML declaration or specified root element
      if (rootElement &&
          !xml.trim().startsWith('<?xml') &&
          !xml.trim().startsWith(`<${rootElement}`)) {
        console.error(`Invalid ${logPrefix}: Missing XML declaration or ${rootElement} root element`);
        return false;
      }

      // Check for specified root element
      if (rootElement &&
          (!xml.includes(`<${rootElement}`) || !xml.includes(`</${rootElement}>`))) {
        console.error(`Invalid ${logPrefix}: Missing ${rootElement} tags`);
        return false;
      }

      // Check for required elements
      for (const element of requiredElements) {
        if (!xml.includes(`<${element}>`) || !xml.includes(`</${element}>`)) {
          console.error(`Invalid ${logPrefix}: Missing ${element} tags`);
          return false;
        }
      }

      // Check for well-formed XML by looking for unmatched tags
      const openTags: string[] = [];
      const tagRegex = /<\/?([a-zA-Z0-9:]+)[^>]*>/g;
      let match;

      while ((match = tagRegex.exec(xml)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];

        // Skip self-closing tags and processing instructions
        if (fullTag.endsWith('/>') || fullTag.startsWith('<?')) {
          continue;
        }

        // Check if it's an opening or closing tag
        if (fullTag.startsWith('</')) {
          // Closing tag
          if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
            console.error(`Invalid ${logPrefix}: Unmatched closing tag ${tagName}`);
            return false;
          }
          openTags.pop();
        } else {
          // Opening tag
          openTags.push(tagName);
        }
      }

      // Check if all tags are closed
      if (openTags.length > 0) {
        console.error(`Invalid ${logPrefix}: Unclosed tags: ${openTags.join(', ')}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`${logPrefix} validation error:`, error);
      return false;
    }
  }

  /**
   * Escape special characters in XML
   * @param str String to escape
   * @returns Escaped string
   */
  public static escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
