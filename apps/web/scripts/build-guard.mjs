if (process.env.ZIDCMS_FAIL_BUILD === '1') {
  console.error(
    'ZIDCMS_FAIL_BUILD=1: build sengaja digagalkan (uji TC-PUB-07). Hapus variabel ini untuk build normal.',
  );
  process.exit(1);
}
