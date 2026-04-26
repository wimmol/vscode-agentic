import { TEMPLATE_COLOR_FALLBACK } from '../../../constants/templateColor';

interface TemplateLabelProps {
  /** Template name — display text only. */
  name: string;
  /** Hex colour snapshot stored on the agent. Falls back to a neutral swatch
   *  when null. */
  color: string | null;
}

/**
 * Colour-dot + mono template name, sits on the left of an agent tile's
 * top row. If the template name is falsy, renders nothing.
 */
export const TemplateLabel = ({ name, color }: TemplateLabelProps) => {
  if (!name) return null;
  const resolved = color ?? TEMPLATE_COLOR_FALLBACK;
  return (
    <span className="tpl-label" style={{ ['--tpl-color' as string]: resolved }}>
      {name}
    </span>
  );
};
