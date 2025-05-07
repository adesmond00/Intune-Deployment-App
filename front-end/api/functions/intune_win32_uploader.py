def upload_intunewin(
    path: str | Path,
    display_name: str,
    package_id: str,
    description: Optional[str] = None,
    publisher: str = "",
    detection_script: Optional[str] = None,
    install_command: Optional[str] = None,
    uninstall_command: Optional[str] = None,
) -> str:
    """
    End‑to‑end helper.

    Parameters
    ----------
    description : str, optional
        Descriptive text shown in Intune. Defaults to display_name if omitted.
    detection_script : str, optional
        A PowerShell detection script. Defaults to "exit 0" if omitted.
    package_id : str
        The Winget package identifier.
    install_command : str, optional
        Custom install command. If omitted, a default command will be generated.
    uninstall_command : str, optional
        Custom uninstall command. If omitted, a default command will be generated.

    Returns
    -------
    The new mobileApp (Win32 LOB) ID.
    """
    logger.info("Starting Win32 upload: %s → '%s'", path, display_name)
    
    # Handle relative paths by resolving them relative to the API directory
    # This ensures the file can be found regardless of the current working directory
    if not os.path.isabs(path):
        api_dir = os.path.join(os.path.dirname(__file__), '..')
        abs_path = os.path.abspath(os.path.join(api_dir, path))
        logger.info(f"Converting relative path '{path}' to absolute path: {abs_path}")
        intunewin = Path(abs_path)
    else:
        intunewin = Path(path).expanduser().resolve().absolute()
        
    # Check if file exists
    if not intunewin.exists():
        raise FileNotFoundError(f"The .intunewin file was not found at: {intunewin}")
        
    meta, encrypted = _parse_detection_xml(intunewin)

    app_id = _create_app_shell(
        display_name,
        description,
        publisher or "Unknown",
        meta["file_name"],
        package_id,
        detection_script or "exit 0",
        install_command,
        uninstall_command,
    )
    logger.info("Created app shell. ID: %s", app_id)
    version_id = _create_content_version(app_id)
    logger.info("Created content version: %s", version_id)
    ph = _create_file_placeholder(app_id, version_id, meta, encrypted)
    logger.info("Placeholder file created: %s", ph["id"])
    ph = _wait_for_storage_uri(app_id, version_id, ph["id"])
    _upload_to_blob(encrypted, ph["azureStorageUri"])
    _commit_file(app_id, version_id, ph["id"], meta)
    _wait_for_commit(app_id, version_id, ph["id"])
    _commit_content_version(app_id, version_id)
    _wait_for_published(app_id)

    logger.info("Upload finished successfully. App ID: %s", app_id)
    return app_id
