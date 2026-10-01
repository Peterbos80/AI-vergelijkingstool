import { roomMarkup, type SceneId } from './rooms';
import { VIEWBOX } from './iso';

/**
 * A world as a maquette (decorative: the caption next to it carries the
 * meaning). `uid` must be unique on the page; it names the scene's light.
 */
export function WorldScene({ world, uid, className }: { world: SceneId; uid: string; className?: string }) {
  return (
    <svg
      className={className ? `scene ${className}` : 'scene'}
      data-world={world}
      viewBox={VIEWBOX}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: roomMarkup(world, uid) }}
    />
  );
}
