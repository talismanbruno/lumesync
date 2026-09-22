const major = Number(process.versions.node.split('.')[0]);
if (major !== 20) {
  console.error(`Lume requires Node.js 20; found ${process.version}.`);
  process.exit(1);
}
