/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deploy auf den ZHL-Node-20-Slot: der Container führt `npm install && npm start`
  // im Webroot aus → wir nutzen den normalen Next-Production-Server (`next start`)
  // mit in package.json deklarierten Dependencies (KEIN standalone — das würde
  // mit dem serverseitigen npm install kollidieren). Siehe docs/DEPLOY.md.
};

export default nextConfig;
