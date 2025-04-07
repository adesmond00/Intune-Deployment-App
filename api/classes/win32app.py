class Win32LobApp:
    def __init__(self, 
                 display_name,
                 description,
                 publisher,
                 install_command_line,
                 uninstall_command_line,
                 setup_file_path,
                 id=None,
                 large_icon=None,
                 is_featured=False,
                 privacy_information_url=None,
                 information_url=None,
                 owner=None,
                 developer=None,
                 notes=None,
                 publishing_state="notPublished",
                 committed_content_version=None,
                 file_name=None,
                 size=None,
                 applicable_architectures="x64",
                 minimum_free_disk_space_in_mb=None,
                 minimum_memory_in_mb=None,
                 minimum_number_of_processors=None,
                 minimum_cpu_speed_in_mhz=None,
                 rules=None,
                 install_experience=None,
                 return_codes=None,
                 msi_information=None,
                 minimum_supported_windows_release=None):
        
        # Required properties
        self.display_name = display_name
        self.description = description
        self.publisher = publisher
        self.install_command_line = install_command_line
        self.uninstall_command_line = uninstall_command_line
        self.setup_file_path = setup_file_path
        
        # Optional properties with defaults
        self.id = id
        self.large_icon = large_icon
        self.is_featured = is_featured
        self.privacy_information_url = privacy_information_url
        self.information_url = information_url
        self.owner = owner
        self.developer = developer
        self.notes = notes
        self.publishing_state = publishing_state
        self.committed_content_version = committed_content_version
        self.file_name = file_name
        self.size = size
        self.applicable_architectures = applicable_architectures
        self.minimum_free_disk_space_in_mb = minimum_free_disk_space_in_mb
        self.minimum_memory_in_mb = minimum_memory_in_mb
        self.minimum_number_of_processors = minimum_number_of_processors
        self.minimum_cpu_speed_in_mhz = minimum_cpu_speed_in_mhz
        self.rules = rules if rules is not None else []
        self.install_experience = install_experience if install_experience is not None else {"runAsAccount": "system", "deviceRestartBehavior": "basedOnReturnCode"}
        self.return_codes = return_codes if return_codes is not None else []
        self.msi_information = msi_information
        self.minimum_supported_windows_release = minimum_supported_windows_release
        
        # Auto-populated properties
        self.created_date_time = None
        self.last_modified_date_time = None

    def add_rule(self, rule):
        """Add a detection or requirement rule to the app"""
        self.rules.append(rule)
        
    def add_return_code(self, return_code):
        """Add a return code for post-installation behavior"""
        self.return_codes.append(return_code)
    
    def set_msi_information(self, msi_info):
        """Set MSI-specific information for the app"""
        self.msi_information = msi_info
    
    def to_dict(self):
        """Convert the Win32LobApp object to a dictionary for API submission"""
        app_dict = {
            "@odata.type": "#microsoft.graph.win32LobApp",
            "displayName": self.display_name,
            "description": self.description,
            "publisher": self.publisher,
            "installCommandLine": self.install_command_line,
            "uninstallCommandLine": self.uninstall_command_line,
            "setupFilePath": self.setup_file_path
        }
        
        # Add optional properties if they exist
        if self.id:
            app_dict["id"] = self.id
        if self.large_icon:
            app_dict["largeIcon"] = self.large_icon
        if self.is_featured:
            app_dict["isFeatured"] = self.is_featured
        if self.privacy_information_url:
            app_dict["privacyInformationUrl"] = self.privacy_information_url
        if self.information_url:
            app_dict["informationUrl"] = self.information_url
        if self.owner:
            app_dict["owner"] = self.owner
        if self.developer:
            app_dict["developer"] = self.developer
        if self.notes:
            app_dict["notes"] = self.notes
        if self.publishing_state:
            app_dict["publishingState"] = self.publishing_state
        if self.committed_content_version:
            app_dict["committedContentVersion"] = self.committed_content_version
        if self.file_name:
            app_dict["fileName"] = self.file_name
        if self.size:
            app_dict["size"] = self.size
        if self.applicable_architectures:
            app_dict["applicableArchitectures"] = self.applicable_architectures
        if self.minimum_free_disk_space_in_mb:
            app_dict["minimumFreeDiskSpaceInMB"] = self.minimum_free_disk_space_in_mb
        if self.minimum_memory_in_mb:
            app_dict["minimumMemoryInMB"] = self.minimum_memory_in_mb
        if self.minimum_number_of_processors:
            app_dict["minimumNumberOfProcessors"] = self.minimum_number_of_processors
        if self.minimum_cpu_speed_in_mhz:
            app_dict["minimumCpuSpeedInMHz"] = self.minimum_cpu_speed_in_mhz
        if self.rules:
            app_dict["rules"] = self.rules
        if self.install_experience:
            app_dict["installExperience"] = {
                "@odata.type": "microsoft.graph.win32LobAppInstallExperience",
                **self.install_experience
            }
        if self.return_codes:
            app_dict["returnCodes"] = self.return_codes
        if self.msi_information:
            app_dict["msiInformation"] = {
                "@odata.type": "microsoft.graph.win32LobAppMsiInformation",
                **self.msi_information
            }
        if self.minimum_supported_windows_release:
            app_dict["minimumSupportedWindowsRelease"] = self.minimum_supported_windows_release
            
        return app_dict
