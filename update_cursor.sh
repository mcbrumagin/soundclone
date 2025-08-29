#!/bin/bash

# Cursor IDE Update Script
# This script downloads and updates Cursor IDE AppImage to /opt/cursor.appimage

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CURSOR_PATH="/opt/cursor.appimage"
TEMP_DIR="/tmp/cursor_update"
DOWNLOADS_DIR="$HOME/Downloads"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_warning "This script is not running as root. Installation to /opt/ will require sudo privileges."
        return 1
    fi
    return 0
}

# Function to check root for installation
check_root_for_install() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Root privileges required for installation to /opt/. Please run with sudo."
        exit 1
    fi
}

# Function to create backup
create_backup() {
    if [[ -f "$CURSOR_PATH" ]]; then
        local backup_path="${CURSOR_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        print_status "Creating backup at $backup_path"
        cp "$CURSOR_PATH" "$backup_path"
        print_success "Backup created successfully"
    else
        print_warning "No existing Cursor installation found at $CURSOR_PATH"
    fi
}

# Function to detect Downloads directory
detect_downloads_dir() {
    # Get the actual user's home directory, even when running as sudo
    local actual_user_home
    if [[ -n "$SUDO_USER" ]]; then
        # Running with sudo, get the original user's home
        actual_user_home=$(eval echo "~$SUDO_USER")
    else
        # Not running with sudo, use current home
        actual_user_home="$HOME"
    fi
    
    local possible_dirs=(
        "$actual_user_home/Downloads"
        "$actual_user_home/downloads" 
        "$actual_user_home/Desktop"
        "$(sudo -u "${SUDO_USER:-$USER}" xdg-user-dir DOWNLOAD 2>/dev/null)"
    )
    
    # Send debug info to stderr so it doesn't interfere with the return value
    print_status "Detected user home directory: $actual_user_home" >&2
    print_status "Current \$HOME: $HOME" >&2
    print_status "SUDO_USER: ${SUDO_USER:-not set}" >&2
    
    for dir in "${possible_dirs[@]}"; do
        if [[ -n "$dir" && -d "$dir" ]]; then
            echo "$dir"
            return 0
        fi
    done
    
    return 1
}

# Function to find latest Cursor AppImage in Downloads
find_cursor_appimage() {
    # Try to detect the actual Downloads directory
    local downloads_dir
    if ! downloads_dir=$(detect_downloads_dir); then
        print_error "Could not find Downloads directory" >&2
        print_status "Tried: $HOME/Downloads, $HOME/downloads, $HOME/Desktop" >&2
        return 1
    fi
    
    print_status "Using Downloads directory: $downloads_dir" >&2
    
    if [[ ! -d "$downloads_dir" ]]; then
        print_error "Downloads directory not found: $downloads_dir" >&2
        return 1
    fi
    
    # Look for Cursor AppImage files (case insensitive)
    local cursor_files=()
    while IFS= read -r -d '' file; do
        cursor_files+=("$file")
    done < <(find "$downloads_dir" -maxdepth 1 -type f -iname "*cursor*.appimage" -print0 2>/dev/null | sort -z)
    
    if [[ ${#cursor_files[@]} -eq 0 ]]; then
        print_error "No Cursor AppImage files found in $downloads_dir" >&2
        print_status "Please download the latest Cursor AppImage from https://cursor.com and save it to your Downloads folder" >&2
        print_status "The file should be named something like 'cursor-0.48.0-x86_64.AppImage'" >&2
        return 1
    fi
    
    # Find the most recently modified file
    local latest_file=""
    local latest_time=0
    
    for file in "${cursor_files[@]}"; do
        local file_time=$(stat -c %Y "$file" 2>/dev/null || echo "0")
        if [[ "$file_time" -gt "$latest_time" ]]; then
            latest_time="$file_time"
            latest_file="$file"
        fi
    done
    
    if [[ -z "$latest_file" ]]; then
        print_error "Could not determine the latest Cursor AppImage" >&2
        return 1
    fi
    
    local file_size=$(stat -c%s "$latest_file" 2>/dev/null || echo "0")
    local file_date=$(stat -c %y "$latest_file" 2>/dev/null || echo "unknown")
    
    print_success "Found Cursor AppImage: $(basename "$latest_file")" >&2
    print_status "File size: $file_size bytes" >&2
    print_status "Modified: $file_date" >&2
    
    if [[ "$file_size" -lt 1000000 ]]; then
        print_error "File seems too small ($file_size bytes). Please re-download from https://cursor.com" >&2
        return 1
    fi
    
    echo "$latest_file"
    return 0
}

# Function to verify downloaded file
verify_download() {
    local file_path="$1"
    
    print_status "Verifying file: $file_path"
    
    # Debug information
    print_status "File exists check: $(test -f "$file_path" && echo "YES" || echo "NO")"
    print_status "File readable check: $(test -r "$file_path" && echo "YES" || echo "NO")"
    print_status "File size (stat): $(stat -c%s "$file_path" 2>/dev/null || echo "FAILED")"
    print_status "File size (ls): $(ls -la "$file_path" 2>/dev/null || echo "FAILED")"
    
    # Check if file exists first
    if [[ ! -f "$file_path" ]]; then
        print_error "File does not exist: $file_path"
        return 1
    fi
    
    # Check if file is readable
    if [[ ! -r "$file_path" ]]; then
        print_error "File is not readable: $file_path"
        print_status "Trying to fix permissions..."
        chmod +r "$file_path" 2>/dev/null || print_warning "Could not fix read permissions"
    fi
    
    # Check if file is not empty
    if [[ ! -s "$file_path" ]]; then
        print_error "File appears to be empty"
        return 1
    fi
    
    # Check file type
    local file_type=$(file "$file_path" 2>/dev/null || echo "unknown")
    print_status "File type: $file_type"
    if [[ ! "$file_type" =~ "ELF" ]]; then
        print_warning "File doesn't appear to be an ELF executable, but proceeding anyway"
    fi
    
    print_success "File verification passed"
    return 0
}

# Function to install Cursor
install_cursor() {
    local temp_file="$1"
    
    print_status "Installing Cursor IDE to $CURSOR_PATH"
    
    # Ensure the directory exists
    mkdir -p "$(dirname "$CURSOR_PATH")"
    
    # Move the file
    mv "$temp_file" "$CURSOR_PATH"
    
    # Make it executable
    chmod +x "$CURSOR_PATH"
    
    print_success "Cursor IDE installed successfully"
}

# Function to create desktop entry
create_desktop_entry() {
    local desktop_file="/usr/share/applications/cursor.desktop"
    
    print_status "Creating desktop entry..."
    
    cat > "$desktop_file" << EOF
[Desktop Entry]
Name=Cursor
Comment=The AI-first code editor
Exec=$CURSOR_PATH --no-sandbox --disable-gpu-sandbox --disable-software-rasterizer %F
Icon=/opt/cursor.png
Terminal=false
Type=Application
Categories=Development;IDE;
StartupWMClass=Cursor
MimeType=text/plain;inode/directory;
EOF
    
    chmod 644 "$desktop_file"
    print_success "Desktop entry created at $desktop_file"
}

# Function to create command line symlink
create_symlink() {
    local symlink_path="/usr/local/bin/cursor"
    
    print_status "Creating command line symlink..."
    
    # Remove existing symlink if it exists
    if [[ -L "$symlink_path" ]]; then
        rm "$symlink_path"
    fi
    
    # Create new symlink
    ln -sf "$CURSOR_PATH" "$symlink_path"
    
    print_success "Command line symlink created at $symlink_path"
    print_status "You can now use: cursor <path> to open projects"
}

# Function to cleanup
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        print_status "Cleaning up temporary files..."
        rm -rf "$TEMP_DIR"
        print_success "Cleanup completed"
    fi
}

# Function to show version info
show_version() {
    if [[ -f "$CURSOR_PATH" ]]; then
        print_status "Checking Cursor version..."
        # Try to get version info (this might not work for all AppImages)
        "$CURSOR_PATH" --version 2>/dev/null || print_warning "Unable to determine version"
    fi
}

# Main execution
main() {
    print_status "Starting Cursor IDE update process..."
    
    # Check prerequisites (but don't exit if not root)
    local is_root=0
    if check_root; then
        is_root=1
    fi
    
    # Create backup of existing installation (only if root and file exists)
    if [[ $is_root -eq 1 ]]; then
        create_backup
    elif [[ -f "$CURSOR_PATH" ]]; then
        print_warning "Cannot create backup without root privileges"
    fi
    
    # Find latest Cursor AppImage in Downloads folder
    local cursor_file
    print_status "Looking for Cursor AppImage in Downloads folder..."
    if ! cursor_file=$(find_cursor_appimage); then
        print_error "Could not find Cursor AppImage in Downloads folder"
        print_status "Please download the latest version from https://cursor.com/en/downloads"
        print_status "Save it to your Downloads folder and run this script again"
        cleanup
        exit 1
    fi
    
    if [[ -z "$cursor_file" ]]; then
        print_error "AppImage search returned empty path"
        cleanup
        exit 1
    fi
    
    # Verify the download
    if ! verify_download "$cursor_file"; then
        print_error "Download verification failed"
        cleanup
        exit 1
    fi
    
    # Check root privileges before installation
    check_root_for_install
    
    # Install Cursor
    install_cursor "$cursor_file"
    
    # Create desktop entry
    create_desktop_entry
    
    # Create command line symlink
    create_symlink
    
    # Show version info
    show_version
    
    # Cleanup
    cleanup
    
    print_success "Cursor IDE update completed successfully!"
    print_status "You can now run Cursor from: $CURSOR_PATH"
    print_status "Or search for 'Cursor' in your application menu"
    print_status "Command line usage: cursor <path> to open projects"
}

# Handle script interruption
trap cleanup EXIT INT TERM

# Run main function
main "$@" 