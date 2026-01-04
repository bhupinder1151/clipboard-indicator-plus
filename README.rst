============================
📋 Clipboard Indicator Plus
============================

This is a **personal fork** of the popular Clipboard Indicator GNOME Shell extension 
with additional features for my own use.

🔗 Original Extension
----------------------

| **Original Repository:** https://github.com/Tudmotu/gnome-shell-extension-clipboard-indicator
| **Original Author:** Tudmotu
| **GNOME Extensions:** https://extensions.gnome.org/extension/779/clipboard-indicator/

All credit for the original extension goes to Tudmotu and contributors.

|Screenshot|

.. |Screenshot| image:: ./screenshot.png
  :width: 400
  :alt: A screenshot of the clipboard manager, showing clipboard history including images

✨ Fork Features
-----------------

This fork adds the following features on top of the original extension:

**Custom Storage Location**
  - Choose a custom folder for storing clipboard history instead of ``~/.cache/``
  - Toggle in preferences under "Storage" section
  - Useful for keeping clipboard data on encrypted drives or custom locations

**QR Code Generation**
  - Generate QR codes from any clipboard text item
  - Click the QR button (📷) on any text entry in the clipboard menu
  - Uses local web server for sharing text of any size
  - Mobile-friendly web page with "Copy to Clipboard" button
  - Designed for quick laptop-to-mobile text transfer

🧰 Original Features
---------------------

- Highly customizable
- Supports both text and images
- Allows pinning items to top
- Includes a "private" mode
- Has configurable shortcuts
- Keyboard control

In-Menu Keyboard Controls
^^^^^^^^^^^^^^^^^^^^^^^^^^

- Use arrows to navigate
- :code:`v` to paste directly from menu
- :code:`p` to pin item
- :code:`<Delete>` to delete an item

📦 Install from source
-----------------------

Clone and install::

    $ git clone <this-repo> ~/.local/share/gnome-shell/extensions/clipboard-indicator-plus
    $ cd ~/.local/share/gnome-shell/extensions/clipboard-indicator-plus
    $ make compile-settings

Enable the extension::

    $ gnome-extensions enable clipboard-indicator-plus

**Requirements for QR feature:**

::

    $ sudo apt install qrencode

📋 Requirements
----------------

- GNOME 46+
- ``qrencode`` package (for QR code generation)

⚠️ Note
--------

This is a personal fork with modifications. For the official extension, 
please visit the `original repository <https://github.com/Tudmotu/gnome-shell-extension-clipboard-indicator>`_.
