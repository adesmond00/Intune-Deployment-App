from ..functions.intune_win32_uploader import upload_intunewin

new_app_id = upload_intunewin(
    path="api/files/Winget-InstallPackage.intunewin",
    display_name="7‑Zip (x64)",
    publisher="7‑Zip.org",
)

print(f"✅ Uploaded – new app id: {new_app_id}")
