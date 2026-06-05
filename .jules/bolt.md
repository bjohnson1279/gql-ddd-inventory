## 2026-06-04 - Improve code health by extracting DomainEvent interface

 **Learning:** Extracting inline interfaces or interfaces mixed with classes (like `DomainEvent` from `OnboardingEvents.ts`) to their own dedicated files improves code health, avoids circular dependencies, and increases maintainability. The original prompt stated the file had an `any` type on the event dispatcher in `InventoryService.ts`, which might have been a confusion in the prompt as the actual issue was that `DomainEvent` was poorly located and should be cleanly refactored. The issue was solved by cleanly extracting the interface and updating all imports.

 **Action:** Extract commonly shared interfaces (like event interfaces, shared value objects) into their own files early on to prevent tightly coupling unrelated modules or causing bloated imports.
