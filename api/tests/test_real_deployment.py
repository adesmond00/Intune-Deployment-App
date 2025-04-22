from ..functions.intune_win32_uploader import upload_intunewin

new_app_id = upload_intunewin(
    path="api/files/Winget-InstallPackage.intunewin",
    display_name="Notepad++",
    package_id="Notepad++.Notepad++",
    publisher="Notepad++ Team",
    description='test'
)

print(f"✅ Uploaded – new app id: {new_app_id}")
