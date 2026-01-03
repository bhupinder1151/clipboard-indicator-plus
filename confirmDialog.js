import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export class DialogManager {
  #openDialog;

  open(title, message, sub_message, ok_label, cancel_label, callback) {
    if (this.#openDialog) return;
    this.#openDialog = new ConfirmDialog(title, message + "\n" + sub_message, ok_label, cancel_label, callback);
    this.#openDialog.onFinish = () => this.#openDialog = null;
    this.#openDialog.open();
  }

  destroy() {
    if (this.#openDialog) this.#openDialog.destroy();
    this.#openDialog = null;
  }
}

export class QRDialogManager {
  #openDialog;

  open(qrImagePath, originalText, textServer = null) {
    if (this.#openDialog) return;
    this.#openDialog = new QRDialog(qrImagePath, originalText, textServer);
    this.#openDialog.onFinish = () => this.#openDialog = null;
    this.#openDialog.open();
  }

  destroy() {
    if (this.#openDialog) this.#openDialog.destroy();
    this.#openDialog = null;
  }
}

const ConfirmDialog = GObject.registerClass(
  class ConfirmDialog extends ModalDialog.ModalDialog {

    _init(title, desc, ok_label, cancel_label, callback) {
      super._init();

      let main_box = new St.BoxLayout({
        vertical: false
      });
      this.contentLayout.add_child(main_box);

      let message_box = new St.BoxLayout({
        vertical: true
      });
      main_box.add_child(message_box);

      let subject_label = new St.Label({
        style: 'font-weight: bold',
        x_align: Clutter.ActorAlign.CENTER,
        text: title
      });
      message_box.add_child(subject_label);

      let desc_label = new St.Label({
        style: 'padding-top: 12px',
        x_align: Clutter.ActorAlign.CENTER,
        text: desc
      });
      message_box.add_child(desc_label);

      this.setButtons([
        {
          label: cancel_label,
          action: () => {
            this.close();
            this.onFinish();
          },
          key: Clutter.Escape
        },
        {
          label: ok_label,
          action: () => {
            this.close();
            this.onFinish();
            callback();
          }
        }
      ]);
    }
  }
);

const QRDialog = GObject.registerClass(
  class QRDialog extends ModalDialog.ModalDialog {
    _init(qrImagePath, originalText, textServer = null) {
      super._init();

      this._qrImagePath = qrImagePath;
      this._textServer = textServer;
      this._isServerMode = textServer !== null;

      let main_box = new St.BoxLayout({
        vertical: true,
        style: 'spacing: 12px;'
      });
      this.contentLayout.add_child(main_box);

      // Title
      let title_label = new St.Label({
        style: 'font-weight: bold; font-size: 14px;',
        x_align: Clutter.ActorAlign.CENTER,
        text: this._isServerMode ? 'QR Code (URL)' : 'QR Code'
      });
      main_box.add_child(title_label);

      // QR Code Image
      const gicon = Gio.icon_new_for_string(qrImagePath);
      const qrImage = new St.Icon({
        gicon: gicon,
        icon_size: 200,
        x_align: Clutter.ActorAlign.CENTER
      });
      main_box.add_child(qrImage);

      // URL or text preview
      if (this._isServerMode) {
        // Show the URL for manual typing
        let url_label = new St.Label({
          style: 'font-size: 12px; color: #00d4ff; font-family: monospace;',
          x_align: Clutter.ActorAlign.CENTER,
          text: originalText
        });
        main_box.add_child(url_label);

        let hint_label = new St.Label({
          style: 'font-size: 10px; color: #888;',
          x_align: Clutter.ActorAlign.CENTER,
          text: 'Scan QR or type URL on same WiFi network'
        });
        main_box.add_child(hint_label);
      } else {
        // Truncated text preview
        const previewText = originalText.length > 50
          ? originalText.substring(0, 50) + '...'
          : originalText;
        let text_label = new St.Label({
          style: 'font-size: 11px; color: #888;',
          x_align: Clutter.ActorAlign.CENTER,
          text: previewText
        });
        main_box.add_child(text_label);
      }

      this.setButtons([
        {
          label: 'Close',
          action: () => {
            this._cleanup();
            this.close();
            this.onFinish();
          },
          key: Clutter.Escape
        },
        {
          label: 'Save to Downloads',
          action: () => {
            this._saveToDownloads();
          }
        }
      ]);
    }

    _cleanup() {
      if (this._textServer) {
        this._textServer.stop();
        this._textServer = null;
      }
    }

    _saveToDownloads() {
      const downloadsPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destPath = `${downloadsPath}/qrcode_${timestamp}.png`;

      try {
        const sourceFile = Gio.file_new_for_path(this._qrImagePath);
        const destFile = Gio.file_new_for_path(destPath);
        sourceFile.copy(destFile, Gio.FileCopyFlags.NONE, null, null);

        // Show notification or just close
        this.close();
        this.onFinish();
      } catch (e) {
        console.error('Failed to save QR code:', e);
      }
    }
  }
);
