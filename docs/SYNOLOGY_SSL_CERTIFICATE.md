# Synology SSL certificate for `https://kodi`

This runbook creates a private Root Certificate Authority (CA), uses it to
sign a server certificate for the LAN hostname `kodi`, imports the server
certificate into Synology DSM, and trusts the Root CA on client devices.

This is intended only for the private LAN deployment. It does not change the
public Cloudflare certificate or synchronization setup.

## Before you begin

- Ensure `kodi` resolves to the NAS IP address on every client. Prefer a local
  DNS entry. A Windows `hosts` entry helps only that Windows computer and does
  not help Android devices.
- The certificate name must exactly match the URL. A certificate for `kodi`
  does not automatically cover `kodi.local`, the NAS IP address, or another
  hostname.
- Create the certificate files outside the Git repository.
- Keep `ca.key` offline and private. Never upload it to DSM, copy it to client
  devices, or commit it to Git.
- Keep `kodi.key` private. Upload it only to DSM.

## 1. Create the Root CA

Create a private working directory, then generate the Root CA key:

```sh
mkdir kodi-certificates
cd kodi-certificates
openssl genrsa -out ca.key 4096
```

Create the self-signed Root CA certificate:

```sh
openssl req -x509 -new -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/CN=Kodi Root CA/O=Home LAN" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "subjectKeyIdentifier=hash"
```

`ca.crt` is the public Root CA certificate to install on trusted devices.
`ca.key` is the private signing key and must remain protected.

## 2. Create the server key and request

Generate the private server key:

```sh
openssl genrsa -out kodi.key 2048
```

Create `kodi.cnf` with the following contents:

```ini
[req]
prompt = no
distinguished_name = distinguished_name
req_extensions = req_ext

[distinguished_name]
CN = kodi
O = Home LAN

[req_ext]
subjectAltName = @alt_names
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = kodi
```

If clients will use another hostname, add it before generating the request:

```ini
DNS.2 = kodi.local
```

If HTTPS access by IP address is genuinely required, add the NAS address as an
IP SAN. A DNS entry is preferable because a NAS address may change:

```ini
IP.1 = 192.168.0.3
```

Generate the certificate signing request (CSR):

```sh
openssl req -new -key kodi.key -out kodi.csr -config kodi.cnf
```

## 3. Sign the server certificate

Sign the request with the private Root CA:

```sh
openssl x509 -req -in kodi.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out kodi.crt -days 825 -sha256 -extfile kodi.cnf -extensions req_ext
```

Verify the result before uploading it:

```sh
openssl verify -CAfile ca.crt kodi.crt
openssl x509 -in kodi.crt -noout -subject -issuer -dates -ext subjectAltName
```

The first command should report `kodi.crt: OK`, and the SAN output should
contain `DNS:kodi`.

## 4. Import and assign the certificate in DSM

In DSM 7, open:

```text
Control Panel > Security > Certificate > Add
```

Choose **Add a new certificate**, then **Import certificate**. Supply:

| DSM field | File |
| --- | --- |
| Private key | `kodi.key` |
| Certificate | `kodi.crt` |
| Intermediate certificate | Leave blank |

The Root CA directly signed this server certificate, so an intermediate
certificate is not required. Do not upload `ca.key`.

After importing, open **Settings** or **Configure** on the Certificate page and
assign the new certificate to the HTTPS reverse-proxy service used by `kodi`.
DSM applies the change to its managed web server.

The reverse proxy should terminate HTTPS and continue forwarding internally to
the native application:

| Setting | Value |
| --- | --- |
| Source protocol | HTTPS |
| Source hostname | `kodi` |
| Source port | `443` |
| Destination protocol | HTTP |
| Destination hostname | `127.0.0.1` |
| Destination port | `8181` |

If DSM reserves source port 443 on this model/configuration, use an available
HTTPS source port such as 8443. The URL will then be
`https://kodi:8443`; the certificate remains valid because ports are not part
of certificate name matching.

Do not configure router port forwarding. Keep the native Node.js service
restricted to the LAN.

## 5. Trust the Root CA on devices

Only distribute `ca.crt`. Never distribute `ca.key` or `kodi.key`.

### Windows

1. Open `ca.crt` and choose **Install Certificate**.
2. Select **Local Machine** if the account has administrator access; otherwise
   use **Current User**.
3. Choose **Place all certificates in the following store**.
4. Select **Trusted Root Certification Authorities**.
5. Complete the import and restart Chrome.

### Android

The labels differ slightly by Android vendor and version:

1. Open **Settings > Security > Encryption & credentials**.
2. Choose **Install a certificate > CA certificate**.
3. Select `ca.crt` and confirm the security warning.
4. Do not install it as a Wi-Fi certificate, VPN certificate, or user/client
   certificate.

Some managed Android devices prohibit user-installed CAs. Some Android apps
also reject user-installed CAs even when Chrome accepts them.

### Important Android Chrome refresh step

After installing or replacing the CA/server certificate, Android Chrome may
continue showing the old certificate result. Clear Chrome's cache and force
stop Chrome before testing again:

```text
Android Settings > Apps > Chrome > Storage & cache > Clear cache
Android Settings > Apps > Chrome > Force stop
```

Then reopen Chrome and browse to `https://kodi`. If the old certificate still
appears, close all Chrome tabs for `kodi` and restart the Android device. Clear
Chrome application data only as a last resort because it can remove local
browser state.

## 6. Verify from a client

Open:

```text
https://kodi/
https://kodi/api/health
```

If OpenSSL is available on a client, inspect the certificate DSM is serving:

```sh
openssl s_client -connect kodi:443 -servername kodi -showcerts
```

For a custom source port, replace `443` with that port. Confirm that the
certificate subject/SAN is for `kodi` and the issuer is `Kodi Root CA`.

## Files and handling summary

| File | Purpose | Handling |
| --- | --- | --- |
| `ca.key` | Root CA private signing key | Store offline; never upload or share |
| `ca.crt` | Public Root CA certificate | Install on trusted client devices |
| `kodi.key` | DSM server private key | Upload only to DSM; keep private |
| `kodi.csr` | Server signing request | May be retained or deleted after signing |
| `kodi.crt` | DSM server certificate | Upload to DSM |
| `ca.srl` | Root CA serial state | Keep with the CA if issuing future certificates |

If `ca.key` is exposed, remove the Root CA from every device, create a new CA,
and issue a replacement DSM certificate.
