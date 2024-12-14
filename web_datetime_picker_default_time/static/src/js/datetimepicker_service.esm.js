import {patch} from "@web/core/utils/patch";
import {
    areDatesEqual,
    formatDate,
    formatDateTime,
    parseDate,
    parseDateTime,
} from "@web/core/l10n/dates";
import {localization} from "@web/core/l10n/localization";
import {ensureArray, zip, zipWith} from "@web/core/utils/arrays";
import {deepCopy} from "@web/core/utils/objects";
import {datetimePickerService} from "@web/core/datetime/datetimepicker_service";

const FOCUS_CLASSNAME = "text-primary";

const formatters = {
    date: formatDate,
    datetime: formatDateTime,
};

const listenedElements = new WeakSet();

// OVERRIDE:
// - Add custom parsers to modify date/time parsing behavior.
// - Update `isEndDateInput` inside `updateValueFromInputs` to correctly identify end date inputs.
patch(datetimePickerService, {
    start(env, {popover: popoverService}) {
        const originalService = super.start(env, {popover: popoverService});
        return {
            create: (hookParams, getInputs = () => [hookParams.target, null]) => {
                const originalCreate = originalService.create(hookParams, getInputs);

                // Start custom parsers
                let isEndDateInput = false;

                const isStrDate = (input_string) => {
                    return input_string.trim().length == localization.dateFormat.length;
                };

                const customParseDateTime = (input_value, options) => {
                    const {defaultTime, defaultStartTime, defaultEndTime} =
                        hookParams.pickerProps;
                    const timeToUse = isEndDateInput
                        ? defaultEndTime
                        : defaultStartTime || defaultEndTime || defaultTime;
                    let result = parseDateTime(input_value, options);

                    if (timeToUse && isStrDate(input_value)) {
                        result = result.set({
                            hour: timeToUse.hour,
                            minute: timeToUse.minute,
                            second: timeToUse.second,
                        });
                    }

                    return result;
                };

                const parsers = {
                    date: parseDate,
                    datetime: customParseDateTime,
                };
                // End custom parsers

                const safeConvert = (operation, value) => {
                    const {type} = originalCreate.state;
                    const convertFn = (operation === "format" ? formatters : parsers)[
                        type
                    ];
                    const options = {
                        tz: originalCreate.state.tz,
                        format: hookParams.format,
                    };
                    if (operation === "format") {
                        options.showSeconds = hookParams.showSeconds ?? true;
                        options.condensed = hookParams.condensed || false;
                    }
                    try {
                        return [convertFn(value, options), null];
                    } catch (error) {
                        if (error?.name === "ConversionError") {
                            return [null, error];
                        }
                        throw error;
                    }
                };

                const updateInput = (el, value) => {
                    if (!el) {
                        return;
                    }
                    const [formattedValue] = safeConvert("format", value);
                    el.value = formattedValue || "";
                };

                const updateValue = (value, unit, source) => {
                    const previousValue = originalCreate.state.value;
                    originalCreate.state.value = value;

                    if (areDatesEqual(previousValue, originalCreate.state.value)) {
                        return;
                    }

                    if (unit !== "time") {
                        if (originalCreate.state.range && source === "picker") {
                            if (
                                originalCreate.state.focusedDateIndex === 0 ||
                                (value[0] && value[1] && value[1] < value[0])
                            ) {
                                // If selecting either:
                                // - the first value
                                // - OR a second value before the first:
                                // Then:
                                // - Set the DATE (year + month + day) of all values
                                // to the one that has been selected.
                                const {year, month, day} =
                                    value[originalCreate.state.focusedDateIndex];
                                for (let i = 0; i < value.length; i++) {
                                    value[i] =
                                        value[i] && value[i].set({year, month, day});
                                }
                                originalCreate.state.focusedDateIndex = 1;
                            } else {
                                // If selecting the second value after the first:
                                // - simply toggle the focus index
                                originalCreate.state.focusedDateIndex =
                                    originalCreate.state.focusedDateIndex === 1 ? 0 : 1;
                            }
                        }
                    }

                    hookParams.onChange?.(value);
                };

                const updateValueFromInputs = () => {
                    const values = zipWith(
                        getInputs(),
                        ensureArray(originalCreate.state.value),
                        (el, currentValue) => {
                            if (!el) {
                                return currentValue;
                            }
                            // CUSTOM: Check if the input is start date input
                            const index = getInputs().indexOf(el);
                            isEndDateInput = index === 1;
                            const [parsedValue, error] = safeConvert("parse", el.value);
                            if (error) {
                                updateInput(el, currentValue);
                                return currentValue;
                            }
                            return parsedValue;
                        }
                    );
                    updateValue(
                        values.length === 2 ? values : values[0],
                        "date",
                        "input"
                    );
                };

                const getInput = (valueIndex) => {
                    const el = getInputs()[valueIndex];
                    if (el && hookParams.target.contains(el)) {
                        return el;
                    }
                    return null;
                };

                let lastAppliedValue = null;
                let inputsChanged = [];

                const apply = () => {
                    const valueCopy = deepCopy(originalCreate.state.value);
                    if (areDatesEqual(lastAppliedValue, valueCopy)) {
                        return;
                    }

                    inputsChanged = ensureArray(originalCreate.state.value).map(
                        () => false
                    );

                    hookParams.onApply?.(originalCreate.state.value);
                    lastAppliedValue = valueCopy;
                };

                const saveAndClose = () => {
                    if (popoverService.isOpen) {
                        // Apply will be done in the "onClose" callback
                        popoverService.close();
                    } else {
                        apply();
                    }
                };

                const onInputChange = (ev) => {
                    updateValueFromInputs();
                    inputsChanged[ev.target === getInput(1) ? 1 : 0] = true;
                    if (!originalCreate.isOpen || inputsChanged.every(Boolean)) {
                        saveAndClose();
                    }
                };

                const onInputClick = ({target}) => {
                    originalCreate.open(target === getInput(1) ? 1 : 0);
                };

                const setFocusClass = (input) => {
                    for (const el of getInputs()) {
                        if (el) {
                            el.classList.toggle(
                                FOCUS_CLASSNAME,
                                originalCreate.isOpen && el === input
                            );
                        }
                    }
                };

                const setInputFocus = (inputEl) => {
                    inputEl.selectionStart = 0;
                    inputEl.selectionEnd = inputEl.value.length;

                    setFocusClass(inputEl);
                };

                const onInputFocus = ({target}) => {
                    originalCreate.state.focusedDateIndex =
                        target === getInput(1) ? 1 : 0;
                    setInputFocus(target);
                };

                const onInputKeydown = (ev) => {
                    if (ev.key == "Enter" && ev.ctrlKey) {
                        ev.preventDefault();
                        updateValueFromInputs();
                        return originalCreate.open(ev.target === getInput(1) ? 1 : 0);
                    }
                    switch (ev.key) {
                        case "Enter":
                        case "Escape": {
                            return saveAndClose();
                        }
                        case "Tab": {
                            if (
                                !getInput(0) ||
                                !getInput(1) ||
                                ev.target !== getInput(ev.shiftKey ? 1 : 0)
                            ) {
                                return saveAndClose();
                            }
                        }
                    }
                };

                return {
                    ...originalCreate,
                    enable() {
                        let editableInputs = 0;
                        for (const [el, value] of zip(
                            getInputs(),
                            ensureArray(originalCreate.state.value),
                            true
                        )) {
                            updateInput(el, value);
                            if (
                                el &&
                                !el.disabled &&
                                !el.readOnly &&
                                !listenedElements.has(el)
                            ) {
                                listenedElements.add(el);
                                el.addEventListener("change", onInputChange);
                                el.addEventListener("click", onInputClick);
                                el.addEventListener("focus", onInputFocus);
                                el.addEventListener("keydown", onInputKeydown);
                                editableInputs++;
                            }
                        }
                        const calendarIconGroupEl = getInput(
                            0
                        )?.parentElement.querySelector(".o_input_group_date_icon");
                        if (calendarIconGroupEl) {
                            calendarIconGroupEl.classList.add("cursor-pointer");
                            calendarIconGroupEl.addEventListener("click", () =>
                                originalCreate.open(0)
                            );
                        }
                        if (!editableInputs && originalCreate.isOpen) {
                            saveAndClose();
                        }
                    },
                };
            },
        };
    },
});
