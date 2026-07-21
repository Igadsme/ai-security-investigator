import numpy as np

from detection.yolo_detector import get_dominant_color, TARGET_CLASSES


def test_target_classes_include_surveillance_objects():
    assert TARGET_CLASSES[0] == "person"
    assert TARGET_CLASSES[2] == "car"
    assert TARGET_CLASSES[24] == "backpack"


def test_dominant_color_white():
    frame = np.full((100, 100, 3), (220, 220, 220), dtype=np.uint8)
    color = get_dominant_color(frame, (10, 10, 90, 90))
    assert color == "white"


def test_dominant_color_red():
    frame = np.full((100, 100, 3), (50, 50, 180), dtype=np.uint8)  # BGR red
    color = get_dominant_color(frame, (10, 10, 90, 90))
    assert color == "red"
