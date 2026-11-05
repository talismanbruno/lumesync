const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) {
  console.error(`Lume requires Node.js 24; found ${process.version}.`);
  process.exit(1);
}
