import { useRef, useState } from "react";

// Replays a weapon's arrow flight (see WeaponMark/WeaponLayer) — clicking
// either end of an attack fires this alongside the camera pan, so it reads as
// "watch it land on that" rather than just an instant jump. `nonce` (not just
// the id) is what actually reaches WeaponMark as replayNonce, so clicking the
// same weapon twice in a row still fires a second flight.
export function useWeaponReplay() {
  const [shotState, setShotState] = useState<{ id: string; nonce: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerWeaponShot(weaponId: string) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShotState({ id: weaponId, nonce: Date.now() });
    timeoutRef.current = setTimeout(() => setShotState(null), 700);
  }

  return { shotState, triggerWeaponShot };
}
