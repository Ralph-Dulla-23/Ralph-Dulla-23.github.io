package com.ralph.diary;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.MessageDigest;
import java.util.Arrays;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

/** Save a user-created PNG into public Gallery (Pictures) or Downloads using MediaStore.
 *  Android 10+ allows app-owned MediaStore inserts without broad storage access.
 */
@CapacitorPlugin(name = "DiaryMediaStore")
public class DiaryMediaStorePlugin extends Plugin {
    @PluginMethod
    public void savePng(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Direct Gallery/Downloads save requires Android 10+. Use the system share chooser.");
            return;
        }
        final String raw = call.getString("data");
        final String requested = call.getString("fileName", "my-diary-calendar.png");
        final String destination = call.getString("destination", "downloads");
        if (raw == null || raw.length() < 20 || raw.length() > 28_000_000) {
            call.reject("PNG is empty or too large to save"); return;
        }
        final String safeName = requested.replaceAll("[^a-zA-Z0-9_.-]", "_");
        if (!safeName.toLowerCase(java.util.Locale.ROOT).endsWith(".png")) {
            call.reject("Only PNG files are supported"); return;
        }
        Uri uri = null;
        try {
            byte[] image = Base64.decode(raw, Base64.DEFAULT);
            if (image.length > 20_000_000 || image.length < 12 ||
                image[0] != (byte)0x89 || image[1] != (byte)0x50 ||
                image[2] != (byte)0x4E || image[3] != (byte)0x47) {
                call.reject("Invalid PNG image"); return;
            }
            final boolean gallery = "gallery".equals(destination);
            final String directory = gallery ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS;
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, directory + "/MyDiary");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            ContentResolver resolver = getContext().getContentResolver();
            uri = resolver.insert(gallery ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Storage destination unavailable");
            try (OutputStream stream = resolver.openOutputStream(uri, "w")) {
                if (stream == null) throw new IllegalStateException("Could not open output stream");
                stream.write(image);
                stream.flush();
            }
            ContentValues finalValues = new ContentValues();
            finalValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, finalValues, null, null);
            JSObject response = new JSObject();
            response.put("uri", uri.toString());
            response.put("destination", gallery ? "Gallery / Pictures / MyDiary" : "Downloads / MyDiary");
            call.resolve(response);
        } catch (Exception err) {
            if (uri != null) { try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) {} }
            call.reject("Unable to save PNG: " + err.getMessage());
        }
    }
    /** Allowlisted, private on-device cover cache for providers whose images cannot be
     *  used as Canvas cross-origin resources in Android WebView. No public proxy.
     */
    @PluginMethod
    public void getCover(PluginCall call) {
        final String address = call.getString("url", "");
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(address);
                String host = url.getHost().toLowerCase(java.util.Locale.ROOT);
                String[] allowed = { "covers.openlibrary.org", "books.google.com", "books.googleusercontent.com", "media.rawg.io", "images.igdb.com", "cdn.cloudflare.steamstatic.com" };
                if (!"https".equalsIgnoreCase(url.getProtocol()) || !Arrays.asList(allowed).contains(host)) {
                    call.reject("Cover host not supported by private Android cache"); return;
                }
                byte[] digest = MessageDigest.getInstance("SHA-256").digest(address.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                StringBuilder hash = new StringBuilder();
                for (byte b : digest) hash.append(String.format(java.util.Locale.ROOT,"%02x", b & 255));
                File folder = new File(getContext().getCacheDir(), "private-cover-cache");
                if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Cache unavailable");
                File saved = new File(folder, hash + ".image");
                byte[] bytes;
                String contentType;
                if (saved.exists() && saved.length() > 0 && saved.length() < 2_500_000) {
                    try (FileInputStream input = new FileInputStream(saved); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                        byte[] chunk = new byte[8192]; int n;
                        while ((n = input.read(chunk)) != -1) buffer.write(chunk, 0, n);
                        bytes = buffer.toByteArray();
                    }
                    contentType = "image/jpeg"; // Type detected below from magic bytes.
                } else {
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(3500); connection.setReadTimeout(3500);
                    connection.setInstanceFollowRedirects(false);
                    connection.setRequestProperty("User-Agent", "MyDiary/1.0");
                    if (connection.getResponseCode() != 200) throw new IllegalStateException("Cover unavailable");
                    contentType = connection.getContentType();
                    if (contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).startsWith("image/")) throw new IllegalStateException("Not an image");
                    try (java.io.InputStream input = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                        byte[] chunk = new byte[8192]; int n;
                        while ((n = input.read(chunk)) != -1) {
                            if (buffer.size() + n > 2_400_000) throw new IllegalStateException("Cover too large");
                            buffer.write(chunk, 0, n);
                        }
                        bytes = buffer.toByteArray();
                    }
                    if (bytes.length < 16) throw new IllegalStateException("Empty cover");
                    try (FileOutputStream output = new FileOutputStream(saved)) { output.write(bytes); }
                }
                if (bytes[0] == (byte)0x89 && bytes[1] == 0x50) contentType = "image/png";
                else if (bytes[0] == (byte)0xff && bytes[1] == (byte)0xd8) contentType = "image/jpeg";
                else if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F') contentType = "image/webp";
                else throw new IllegalStateException("Unknown cover format");
                JSObject response = new JSObject();
                response.put("dataUrl", "data:" + contentType + ";base64," + Base64.encodeToString(bytes, Base64.NO_WRAP));
                call.resolve(response);
            } catch (Exception error) { call.reject("Cover unavailable: " + error.getMessage()); }
            finally { if (connection != null) connection.disconnect(); }
        }, "diary-cover-cache").start();
    }

}
