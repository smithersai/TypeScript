// A module's top level may await; the file then awaits the module.
export const level = await Promise.resolve(3);
