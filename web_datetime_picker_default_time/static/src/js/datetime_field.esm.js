/* Copyright 2024 Camptocamp
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) */

import {onWillRender, useState} from "@odoo/owl";
import {patch} from "@web/core/utils/patch";
import {
    DateTimeField,
    dateRangeField,
    dateTimeField,
} from "@web/views/fields/datetime/datetime_field";
import {
    listDateRangeField,
    listDateTimeField,
} from "@web/views/fields/datetime/list_datetime_field";
import {useDateTimePicker} from "@web/core/datetime/datetime_hook";
import {areDatesEqual} from "@web/core/l10n/dates";

/**
 * @typedef {import("./datepicker.esm").DateTimePickerProps} DateTimePickerProps
 */

patch(DateTimeField.prototype, {
    // OVERRIDE: add defaultTime, defaultStartTime, defaultEndTime to pickerProps
    setup() {
        const getPickerProps = () => {
            const value = this.getRecordValue();
            /** @type {DateTimePickerProps} */
            const pickerProps = {
                value,
                type: this.field.type,
                range: this.isRange(value),
            };
            if (this.props.maxDate) {
                pickerProps.maxDate = this.parseLimitDate(this.props.maxDate);
            }
            if (this.props.minDate) {
                pickerProps.minDate = this.parseLimitDate(this.props.minDate);
            }
            if (!isNaN(this.props.rounding)) {
                pickerProps.rounding = this.props.rounding;
            } else if (!this.props.showSeconds) {
                pickerProps.rounding = 0;
            }
            if (this.props.maxPrecision) {
                pickerProps.maxPrecision = this.props.maxPrecision;
            }
            if (this.props.minPrecision) {
                pickerProps.minPrecision = this.props.minPrecision;
            }

            // Add defaultTime, defaultStartTime, defaultEndTime to pickerProps
            if (this.props.defaultTime) {
                pickerProps.defaultTime = this.defaultTime;
            }
            if (this.props.defaultStartTime) {
                pickerProps.defaultStartTime = this.defaultStartTime;
            }
            if (this.props.defaultEndTime) {
                pickerProps.defaultEndTime = this.defaultEndTime;
            }
            return pickerProps;
        };

        const dateTimePicker = useDateTimePicker({
            target: "root",
            showSeconds: this.props.showSeconds,
            condensed: this.props.condensed,
            get pickerProps() {
                return getPickerProps();
            },
            onChange: () => {
                this.state.range = this.isRange(this.state.value);
            },
            onApply: () => {
                const toUpdate = {};
                if (Array.isArray(this.state.value)) {
                    // Value is already a range
                    [toUpdate[this.startDateField], toUpdate[this.endDateField]] =
                        this.state.value;
                } else {
                    toUpdate[this.props.name] = this.state.value;
                }

                // If startDateField or endDateField are not set, delete unchanged fields
                for (const fieldName in toUpdate) {
                    if (
                        areDatesEqual(
                            toUpdate[fieldName],
                            this.props.record.data[fieldName]
                        )
                    ) {
                        delete toUpdate[fieldName];
                    }
                }

                if (Object.keys(toUpdate).length) {
                    this.props.record.update(toUpdate);
                }
            },
        });
        // Subscribes to changes made on the picker state
        this.state = useState(dateTimePicker.state);
        this.openPicker = dateTimePicker.open;

        onWillRender(() => this.triggerIsDirty());
    },

    // Getter
    get defaultTime() {
        if (typeof this.props.defaultTime === "string") {
            if (!this.props.record.data[this.props.defaultTime]) {
                return "";
            }
            if (typeof this.props.record.data[this.props.defaultTime] === "string") {
                return JSON.parse(this.props.record.data[this.props.defaultTime]);
            }
            return this.props.record.data[this.props.defaultTime];
        }
        return this.props.defaultTime;
    },

    get defaultStartTime() {
        if (typeof this.props.defaultStartTime === "string") {
            if (!this.props.record.data[this.props.defaultStartTime]) {
                return "";
            }
            if (
                typeof this.props.record.data[this.props.defaultStartTime] === "string"
            ) {
                return JSON.parse(this.props.record.data[this.props.defaultStartTime]);
            }
            return this.props.record.data[this.props.defaultStartTime];
        }
        return this.props.defaultStartTime;
    },

    get defaultEndTime() {
        if (typeof this.props.defaultEndTime === "string") {
            if (!this.props.record.data[this.props.defaultEndTime]) {
                return "";
            }
            if (typeof this.props.record.data[this.props.defaultEndTime] === "string") {
                return JSON.parse(this.props.record.data[this.props.defaultEndTime]);
            }
            return this.props.record.data[this.props.defaultEndTime];
        }
        return this.props.defaultEndTime;
    },

    // OVERRIDE:remove automatic date calculation
    async addDate(valueIndex) {
        this.state.focusedDateIndex = valueIndex;
        this.state.value = this.values;
        this.state.range = true;

        this.openPicker(valueIndex);
    },
});

DateTimeField.props = {
    ...DateTimeField.props,
    defaultTime: {
        type: [
            String,
            {
                type: Object,
                shape: {
                    hour: Number,
                    minute: Number,
                    second: Number,
                },
                optional: true,
            },
        ],
        optional: true,
    },
    defaultStartTime: {
        type: [
            String,
            {
                type: Object,
                shape: {
                    hour: Number,
                    minute: Number,
                    second: Number,
                },
                optional: true,
            },
        ],
        optional: true,
    },
    defaultEndTime: {
        type: [
            String,
            {
                type: Object,
                shape: {
                    hour: Number,
                    minute: Number,
                    second: Number,
                },
                optional: true,
            },
        ],
        optional: true,
    },
};

const superDateTimeExtractProps = dateTimeField.extractProps;
dateTimeField.extractProps = ({attrs, options}, dynamicInfo) => ({
    ...superDateTimeExtractProps({attrs, options}, dynamicInfo),
    defaultTime: options.defaultTime,
});

const superDateRangeExtractProps = dateRangeField.extractProps;
dateRangeField.extractProps = ({attrs, options}, dynamicInfo) => ({
    ...superDateRangeExtractProps({attrs, options}, dynamicInfo),
    defaultStartTime: options.defaultStartTime,
    defaultEndTime: options.defaultEndTime,
});

const superListDateTimeExtractProps = listDateTimeField.extractProps;
listDateTimeField.extractProps = ({attrs, options}, dynamicInfo) => ({
    ...superListDateTimeExtractProps({attrs, options}, dynamicInfo),
    defaultTime: options.defaultTime,
});

const superListDateRangeExtractProps = listDateRangeField.extractProps;
listDateRangeField.extractProps = ({attrs, options}, dynamicInfo) => ({
    ...superListDateRangeExtractProps({attrs, options}, dynamicInfo),
    defaultStartTime: options.defaultStartTime,
    defaultEndTime: options.defaultEndTime,
});
