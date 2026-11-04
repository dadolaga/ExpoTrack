"use client";

import {
  useCallback, useEffect, useId, useRef, useState,
} from "react";

import { TextField } from "@/components/forms/TextField";
import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { productCategories } from "@/features/products/product-categories";

import type { Category } from "@/types/catalog";

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT");
}

export function CategoryPicker({
  categories, categoryIds, value, disabled, hint, error, onChange,
}: {
  categories: Category[];
  categoryIds?: readonly string[];
  value: string | null;
  disabled: boolean;
  hint?: string;
  error?: string;
  onChange: (categoryId: string | null) => void;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const selected = categories.find((category) => category.id === value);
  const terms = normalize(query ?? "").trim().split(/\s+/u);
  const items = productCategories(categories, categoryIds).filter((category) => {
    const name = normalize(category.name);

    return terms.every((term) => name.includes(term));
  });
  const expanded = open && !disabled;
  const active = items.find((category) => category.id === activeId);
  const close = useCallback(() => {
    setOpen(false);
    setQuery(null);
    setActiveId(null);
  }, []);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    function outside(event: PointerEvent) {
      const element = container.current;

      if (event.target instanceof Node && element !== null && !element.contains(event.target)) {
        close();
      }
    }

    document.addEventListener("pointerdown", outside);

    return () => {
      document.removeEventListener("pointerdown", outside);
    };
  }, [close, expanded]);

  useEffect(() => {
    if (expanded && activeId !== null) {
      document.getElementById(`${id}-${activeId}`)?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [
    activeId, expanded, id,
  ]);

  function select(category: Category) {
    close();
    onChange(category.id);
  }

  return (
    <div
      ref={container}
      onBlur={(event) => {
        if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) {
          close();
        }
      }}
    >
      <div className="category-picker-control">
        <TextField
          ref={input}
          label="Categoria"
          required
          requiredIndicator="asterisk"
          hint={hint}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-options` : undefined}
          aria-activedescendant={expanded && active !== undefined ? `${id}-${active.id}` : undefined}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? `${id}-error` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query ?? selected?.name ?? ""}
          placeholder="Cerca categoria per nome…"
          disabled={disabled}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onClick={() => {
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveId(null);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);

              if (items.length === 0) {
                return;
              }

              const index = items.findIndex((category) => category.id === activeId);
              const direction = event.key === "ArrowDown" ? 1 : -1;
              const next = index < 0 && direction < 0 ? items.length - 1 : index + direction;
              const category = items.at((next + items.length) % items.length);

              setActiveId(category?.id ?? null);
            } else if (event.key === "Enter" && expanded) {
              event.preventDefault();

              const category = active ?? (items.length === 1 ? items.at(0) : undefined);

              if (category !== undefined) {
                select(category);
              }
            }
          }}
        />
        <button
          type="button"
          className="category-picker-toggle"
          aria-label={expanded ? "Chiudi elenco categorie" : "Apri elenco categorie"}
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-options` : undefined}
          disabled={disabled}
          onClick={() => {
            if (expanded) {
              close();
            } else {
              setQuery(null);
              input.current?.focus();
              setOpen(true);
            }
          }}
        ><NavigationIcon name="chevronDown" />
        </button>
        {expanded && (
          <div className="category-picker-results">
            <div
              id={`${id}-options`}
              role="listbox"
              aria-label="Categorie disponibili"
            >
              {items.map((category) => (
                <button
                  key={category.id}
                  id={`${id}-${category.id}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={category.id === value}
                  data-active={category.id === activeId}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    select(category);
                  }}
                >{category.name}
                </button>
              ))}
            </div>
            {items.length === 0 && <p role="status">Nessuna categoria trovata.</p>}
          </div>
        )}
      </div>
      {error !== undefined && (
        <p
          id={`${id}-error`}
          className="text-label text-danger"
        >{error}
        </p>
      )}
    </div>
  );
}
