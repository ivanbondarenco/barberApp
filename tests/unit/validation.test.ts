import { describe, expect, it } from "vitest";
import { addressSchema, emailSchema, personNameSchema, sanitizePersonName, sanitizePhone, shopNameSchema } from "@/lib/validation";

describe("filtros mientras se escribe", () => {
  it("el teléfono descarta letras y deja dígitos y separadores", () => {
    expect(sanitizePhone("11 abc 3096-9716")).toBe("11  3096-9716");
    expect(sanitizePhone("+54 9 (11) 3096-9716")).toBe("+54 9 (11) 3096-9716");
    // No deja pasar de 13 dígitos.
    expect(sanitizePhone("12345678901234567").replace(/\D/g, "")).toHaveLength(13);
  });

  it("el nombre descarta números y símbolos, pero no tildes ni ñ", () => {
    expect(sanitizePersonName("Iván 123 Muñoz!")).toBe("Iván  Muñoz");
    expect(sanitizePersonName("María-José O'Neill")).toBe("María-José O'Neill");
  });
});

describe("reglas del alta", () => {
  const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: string) => schema.safeParse(v).success;

  it("nombre de la persona: solo letras", () => {
    expect(ok(personNameSchema, "Iván Bondarenco")).toBe(true);
    expect(ok(personNameSchema, "Iván 2")).toBe(false);
  });

  it("nombre de la barbería: tiene que tener letras", () => {
    expect(ok(shopNameSchema, "Barbería 1990")).toBe(true);
    expect(ok(shopNameSchema, "12345")).toBe(false);
  });

  it("dirección: calle y altura", () => {
    expect(ok(addressSchema, "Av. Corrientes 1234")).toBe(true);
    expect(ok(addressSchema, "Corrientes")).toBe(false);
    expect(ok(addressSchema, "1234567")).toBe(false);
  });

  it("email: válido y en minúsculas", () => {
    expect(emailSchema.parse("  Dueno@Ejemplo.COM ")).toBe("dueno@ejemplo.com");
    expect(ok(emailSchema, "dueno@")).toBe(false);
  });
});
