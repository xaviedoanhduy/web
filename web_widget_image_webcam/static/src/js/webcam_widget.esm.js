/* global Webcam */

import {loadJS} from "@web/core/assets";
import {patch} from "@web/core/utils/patch";
import {_t} from "@web/core/l10n/translation";
import {useService} from "@web/core/utils/hooks";
import {Dialog} from "@web/core/dialog/dialog";
import {ImageField} from "@web/views/fields/image/image_field";
import {Component, onMounted, onWillStart, useState} from "@odoo/owl";

export class WebcamDialog extends Component {
    static template = "web_widget_image_webcam.WebCamDialog";
    static components = {Dialog};
    static props = {
        title: String,
        size: String,
        onSaveClose: Function,
        close: Function,
    };

    setup() {
        this.imageData = false;
        this.orm = useService("orm");
        this.imageData = useState({
            src: "",
        });
        onWillStart(async () => {
            await loadJS("/web_widget_image_webcam/static/src/lib/webcam.js");
            const get_webcam_flash_fallback_mode_config = await this.orm.call(
                "ir.config_parameter",
                "get_webcam_flash_fallback_mode_config"
            );
            Webcam.set({
                width: 320,
                height: 240,
                dest_width: 320,
                dest_height: 240,
                image_format: "jpeg",
                jpeg_quality: 90,
                force_flash: get_webcam_flash_fallback_mode_config === "1",
                fps: 45,
                swfURL: "/web_widget_image_webcam/static/src/lib/webcam.swf",
            });
        });
        onMounted(() => {
            Webcam.attach("#live_webcam");
        });
    }

    get isLive() {
        return Webcam.live;
    }
    onTakeSnap() {
        Webcam.snap((data) => {
            this.imageData.src = data;
        });
    }
    onSaveClose() {
        if (this.imageData.src) {
            this.props.onSaveClose(this.imageData.src);
        }
        this.props.close();
    }
}

patch(ImageField.prototype, {
    setup() {
        super.setup();
        this.dialogService = useService("dialog");
    },

    onWebcamClicked() {
        const dialogProps = {
            size: "large",
            title: _t("WebCam Booth"),
            onSaveClose: (imageData) => {
                const imageDataBase64 = imageData.split(",")[1];
                var approxImgSize =
                    3 * (imageDataBase64.length / 4) -
                    (imageDataBase64.match(/[=]+$/g) || []).length;
                this.onFileUploaded({
                    size: approxImgSize,
                    name: "web-cam-preview.jpeg",
                    type: "image/jpeg",
                    data: imageDataBase64,
                });
            },
            close: () => {
                Webcam.reset();
            },
        };
        this.dialogService.add(WebcamDialog, dialogProps);
    },
});
