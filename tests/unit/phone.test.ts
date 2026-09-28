import { describe, expect, it } from "vitest";
import { whatsappLink } from "@/lib/format";
import { arLocalDigits, arPhoneSchema, isArPhone, toArPhone } from "@/lib/phone";

describe("celulares argentinos", () => {
  it("se queda con los 10 dígitos locales venga como venga", () => {
    expect(arLocalDigits("1130969716")).toBe("1130969716");
    expect(arLocalDigits("11 3096-9716")).toBe("1130969716");
    expect(arLocalDigits("+54 9 11 3096 9716")).toBe("1130969716");
    expect(arLocalDigits("5491130969716")).toBe("1130969716");
    expect(arLocalDigits("(011) 15-3096-9716")).toBe("1130969716");
    expect(arLocalDigits("0 2966 15 123456")).toBe("2966123456");
  });

  it("rechaza lo que no llega a un número completo", () => {
    expect(isArPhone("30969716")).toBe(false);
    expect(isArPhone("11 3096-97160")).toBe(false);
    expect(isArPhone("")).toBe(false);
  });

  it("guarda siempre el mismo formato, sin que haga falta escribir el +54", () => {
    expect(toArPhone("1130969716")).toBe("+54 9 11 3096-9716");
    expect(toArPhone("011 15 3096 9716")).toBe("+54 9 11 3096-9716");
    expect(toArPhone("3514567890")).toBe("+54 9 351 456-7890");
    expect(toArPhone("2966123456")).toBe("+54 9 2966 12-3456");
  });

  it("queda listo para el link de WhatsApp", () => {
    expect(whatsappLink(toArPhone("11 3096-9716"))).toBe("https://wa.me/5491130969716");
  });

  it("el schema normaliza y explica el error", () => {
    expect(arPhoneSchema.parse(" 11 3096 9716 ")).toBe("+54 9 11 3096-9716");
    expect(arPhoneSchema.safeParse("123").success).toBe(false);
  });
});
