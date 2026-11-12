import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ControlProps = { id?: string; children?: ReactNode; "aria-invalid"?: unknown; "aria-describedby"?: string };

/**
 * Le pone al control del campo (el elemento con `id === htmlFor`) `aria-invalid` y
 * `aria-describedby` apuntando al error o la ayuda. Busca también un nivel adentro, para los
 * controles que van envueltos (el celular con el prefijo +54 9, la contraseña con su botón).
 */
function linkControl(node: ReactNode, id: string, describedBy: string | undefined, invalid: boolean, depth = 0): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<ControlProps>;
    if (el.props.id === id) {
      const own = el.props["aria-describedby"];
      return cloneElement(el, {
        "aria-invalid": invalid || el.props["aria-invalid"] || undefined,
        "aria-describedby": [own, describedBy].filter(Boolean).join(" ") || undefined,
      });
    }
    // Solo se baja por envoltorios del DOM (un div): no se tocan los hijos de otros componentes.
    if (depth < 2 && typeof el.type === "string" && el.props.children && typeof el.props.children !== "function") {
      return cloneElement(el, undefined, linkControl(el.props.children, id, describedBy, invalid, depth + 1));
    }
    return child;
  });
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const messageId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-secondary">
        {label}
      </label>
      {linkControl(children, htmlFor, messageId, !!error)}
      {error ? (
        <p id={messageId} className="field-error mt-0">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
