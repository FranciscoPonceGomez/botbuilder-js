/**
 * @module botbuilder-prompts
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { Promiseable, Activity, TurnContext } from 'botbuilder';
import { PromptValidator } from './textPrompt';
import { sendPrompt } from './internal';
import * as Recognizers from '@microsoft/recognizers-text-date-time';

/**
 * Datetime result returned by `DatetimePrompt`. For more details see the LUIS docs for
 * [builtin.datetimev2](https://docs.microsoft.com/en-us/azure/cognitive-services/luis/luis-reference-prebuilt-entities#builtindatetimev2).
 */
export interface FoundDatetime {
    /** 
     * TIMEX expression representing ambiguity of the recognized time. 
     */
    timex: string;

    /** 
     * Type of time recognized. Possible values are 'date', 'time', 'datetime', 'daterange', 
     * 'timerange', 'datetimerange', 'duration', or 'set'.
     */
    type: string;

    /** 
     * Value of the specified [type](#type) that's a reasonable approximation given the ambiguity
     * of the [timex](#timex).
     */
    value: string;
}

/** Prompts the user to reply with a date or time. */
export interface DatetimePrompt<O = FoundDatetime[]> {
    /**
     * Sends a formated prompt to the user. 
     * @param context Context for the current turn of conversation.
     * @param prompt Text or activity to send as the prompt.
     * @param speak (Optional) SSML that should be spoken for prompt. The prompts `inputHint` will be automatically set to `expectingInput`.
     */
    prompt(context: TurnContext, prompt: string|Partial<Activity>, speak?: string): Promise<void>;

    /**
     * Recognizes and validates the users reply.
     * @param context Context for the current turn of conversation.
     */
    recognize(context: TurnContext): Promise<O|undefined>;
}

/**
 * Creates a new prompt that asks the user to reply with a date or time.
 * @param validator (Optional) validator for providing additional validation logic or customizing the prompt sent to the user when invalid.
 * @param defaultLocale (Optional) locale to use if `context.activity.locale` not specified. Defaults to a value of `en-us`.
 */
export function createDatetimePrompt<O = FoundDatetime[]>(validator?: PromptValidator<FoundDatetime[], O>, defaultLocale?: string): DatetimePrompt<O> {
    return {
        prompt: function prompt(context, prompt, speak) {
            return sendPrompt(context, prompt, speak);
        },
        recognize: function recognize(context) {
            const request = context.activity || {};
            const utterance = request.text || '';
            const locale =  request.locale || defaultLocale || 'en-us';
            const results = Recognizers.recognizeDateTime(utterance, locale);
            const values = results.length > 0 && results[0].resolution ? results[0].resolution.values : undefined;
            return Promise.resolve(validator ? validator(context, values) : values as any);
        }
    };
}
