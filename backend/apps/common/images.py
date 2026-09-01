from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass


def media_url(file_field):
    """Return the storage URL as-is (S3/CDN). Never read or transform the file."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    return url or None


def optimize_image_field(instance, field_name, max_side=1280, quality=80):
    field_file = getattr(instance, field_name, None)
    if not field_file or getattr(field_file, "_committed", True):
        return
    raw = getattr(field_file, "file", field_file)
    try:
        raw.seek(0)
    except Exception:
        pass
    data = raw.read()
    try:
        raw.seek(0)
    except Exception:
        pass
    if not data:
        return
    optimized = _to_webp(data, getattr(field_file, "name", "image") or "image", max_side, quality)
    if optimized is not None:
        setattr(instance, field_name, optimized)


def _to_webp(data, original_name, max_side, quality):
    from PIL import Image, ImageOps

    ext = Path(original_name).suffix.lower().lstrip(".")
    if ext in {"svg", "gif"}:
        return None
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except Exception:
        return None
    image = ImageOps.exif_transpose(image) or image
    if image.mode == "P":
        image = image.convert("RGBA")
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    save_kwargs = {"format": "WEBP", "quality": quality, "method": 6}
    if image.mode == "RGBA":
        save_kwargs["lossless"] = False
    image.save(buffer, **save_kwargs)
    name = f"{Path(original_name).stem or 'image'}.webp"
    return ContentFile(buffer.getvalue(), name=name)
