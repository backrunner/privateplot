import { useRef, useCallback } from 'preact/hooks';
import Artalk from 'artalk';
import './ArticleComment.scss';
import 'artalk/Artalk.css';

interface Props {
  slug: string;
  title: string;
}

export const ArticleComment = ({ slug, title }: Props) => {
  const artalk = useRef<Artalk>();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContainerInit = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }
      containerRef.current = node;
      if (artalk.current) {
        artalk.current.destroy();
        artalk.current = undefined;
      }
      artalk.current = Artalk.init({
        el: node,
        darkMode: true,
        pageKey: slug,
        pageTitle: title || document.title,
        server: 'https://artalk.backrunner.blog/',
        site: 'PrivatePlot',
      });

      artalk.current.on('list-fetch', () => {
        if (containerRef.current) {
          containerRef.current.classList.add('visible');
        }
      });
    },
    [slug]
  );

  return <div class="article-comment" ref={handleContainerInit} />;
};
