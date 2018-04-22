/**
 * @module botbuilder-prompts
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { Promiseable, Activity, TurnContext, Attachment, TokenResponse, BotFrameworkAdapter, CardFactory, MessageFactory, ActivityTypes } from 'botbuilder';
import { PromptValidator } from './textPrompt';
import { sendPrompt } from './internal';

/** 
 * :package: **botbuilder-prompts**
 * 
 * Defines settings for an OAuthPrompt. 
 */
export interface OAuthPromptSettings {
    /** Name of the OAuth connection being used. */
    connectionName: string;

    /** Title of the cards signin button. */
    title: string;

    /** (Optional) additional text to include on the signin card. */
    text?: string;
}

/** 
 * :package: **botbuilder-prompts**
 * 
 * Prompts the user to sign in using the Bot Frameworks Single Sign On (SSO) service. 
 *
 * **Usage Example**
 *
 * ```JavaScript
 * const { createOAuthPrompt } = require('botbuilder-prompts');
 * 
 * const loginPrompt = createOAuthPrompt({
 *    connectionName: 'GitConnection',
 *    title: 'Login To GitHub'
 * });
 * ```
 * @param O (Optional) type of result returned by the [recognize()](#recognize) method. This defaults to an instance of `TokenResponse` but can be changed by the prompts custom validator.
 */
export interface OAuthPrompt<O = TokenResponse> {
    /**
     * Sends a formated prompt to the user. 
     *
     * An `OAuthCard` will be automatically created and sent to the user requesting them to 
     * signin. If you need to localize the card or customize the message sent to the user for any
     * reason you can pass in the `Activity` to send. This should just be an activity of type 
     * `message` and contain at least one attachment that's an `OAuthCard`.
     *  
     * **Usage Example**
     *
     * ```JavaScript
     * await loginPrompt.prompt(context);
     * ```
     * @param context Context for the current turn of conversation.
     * @param prompt (Optional) activity to send along the user. This should include an attachment containing an `OAuthCard`. If ommited, an activity will be automatically generated.
     */
    prompt(context: TurnContext, prompt?: Partial<Activity>): Promise<void>;

    /**
     * Attempts to resolve the token after [prompt()](#prompt) has been called. There are two core 
     * flows that need to be supported to complete a users signin:
     * 
     * - The automatic signin flow where the SSO service will forward the bot the users access 
     * token using either an `event` or `invoke` activity.
     * - The "magic code" flow where a user is prompted by the SSO service to send the bot a six
     * digit code confirming their identity. This code will be sent as a standard `message` activity.
     * 
     * The `recognize()` method automatically handles both flows for the bot but you should ensure 
     * that you don't accidentally filter out the `event` and `invoke` activities before calling 
     * recognize().  Because of this we generally recommend you put the call to recognize() towards
     * the beginning of your bot logic.
     * 
     * You should also be prepared for the case where the user fails to enter the correct 
     * "magic code" or simply decides they don't want to click the signin button.   
     *  
     * **Usage Example**
     *
     * ```JavaScript
     * const token = await loginPrompt.recognize(context);
     * if (token) {
     *    // Save token and continue.
     * }
     * ```
     * @param context Context for the current turn of conversation.
     * @param connectionName Name of the auth connection to use.
     */
    recognize(context: TurnContext): Promise<O|undefined>;

    /**
     * Attempts to retrieve the cached token for a signed in user. You will generally want to call
     * this before calling [prompt()](#prompt) to send the user a signin card.
     *  
     * **Usage Example**
     *
     * ```JavaScript
     * const token = await loginPrompt.getUserToken(context);
     * if (!token) {
     *    await loginPrompt.prompt(context);
     * }
     * ```
     * @param context Context for the current turn of conversation.
     */
    getUserToken(context: TurnContext): Promise<O|undefined>;

    /**
     * Signs the user out of the service.
     *  
     * **Usage Example**
     *
     * ```JavaScript
     * await loginPrompt.signOutUser(context);
     * ```
     * @param context Context for the current turn of conversation.
     */
    signOutUser(context: TurnContext): Promise<void>;
}


/**
 * :package: **botbuilder-prompts**
 * 
 * Creates a new prompt that asks the user to sign in using the Bot Frameworks Single Sign On (SSO) 
 * service. 
 *
 * **Usage Example**
 *
 * ```JavaScript
 * async function ensureLogin(context, state, botLogic) {
 *    const now = new Date().getTime();
 *    if (state.token && now < (new Date(state.token.expiration).getTime() - 60000)) {
 *       return botLogic(context);
 *    } else {
 *       const loginPrompt = createOAuthPrompt({
 *           connectionName: 'GitConnection',
 *           title: 'Login To GitHub'
 *       });
 *       const token = await state.loginActive ? loginPrompt.recognize(context) : loginPrompt.getUserToken(context);
 *       if (token) {
 *           state.loginActive = false;
 *           state.token = token;
 *           return botLogic(context);
 *       } else if (context.activity.type === 'message') {
 *           if (!state.loginActive) {
 *               state.loginActive = true;
 *               state.loginStart = now;
 *               await loginPrompt.prompt(context);
 *           } else if (now >= (state.loginStart + (5 * 60 * 1000))) {
 *               state.loginActive = false;
 *               await context.sendActivity(`We're having a problem logging you in. Please try again later.`);
 *           }
 *       }
 *    }
 * } 
 * ```
 * @param O (Optional) type of result returned by the `recognize()` method. This defaults to an instance of `TokenResponse` but can be changed by the prompts custom validator.
 * @param settings Configuration settings for the OAuthPrompt.
 * @param validator (Optional) validator for providing additional validation logic or customizing the prompt sent to the user when invalid.
 */
export function createOAuthPrompt<O = TokenResponse>(settings: OAuthPromptSettings, validator?: PromptValidator<TokenResponse, O>): OAuthPrompt<O> {
    return {
        prompt: function prompt(context, prompt) {
            try {
                // Validate adapter type
                if (!('getUserToken' in context.adapter)) { throw new Error(`OAuthPrompt.prompt(): not supported for the current adapter.`) }

                // Format prompt
                if (typeof prompt !== 'object') {
                    prompt = MessageFactory.attachment(CardFactory.oauthCard(
                        settings.connectionName,
                        settings.title,
                        settings.text
                    ));
                } else {
                    // Validate prompt
                    if (!Array.isArray(prompt.attachments)) { throw new Error(`OAuthPrompt.prompt(): supplied prompt missing attachments.`) }
                    const found = prompt.attachments.filter(a => a.contentType === CardFactory.contentTypes.oauthCard);
                    if (found.length == 0) { throw new Error(`OAuthPrompt.prompt(): supplied prompt missing OAuthCard.`) }
                }

                // Send prompt
                return sendPrompt(context, prompt);
            } catch(err) {
                return Promise.reject(err);
            }
        },
        recognize: function recognize(context) {
            // Validate adapter type
            if (!('getUserToken' in context.adapter)) { throw new Error(`OAuthPrompt.recognize(): not supported for the current adapter.`) }

            // Attempt to get the token
            return Promise.resolve()
                .then(() => {
                    if (isTokenResponseEvent(context)) {
                        return Promise.resolve(context.activity.value as TokenResponse);
                    } else if (context.activity.type === ActivityTypes.Message) {
                        const matched = /(\d{6})/.exec(context.activity.text);
                        if (matched && matched.length > 1) {
                            const adapter = context.adapter as BotFrameworkAdapter;
                            return adapter.getUserToken(context, settings.connectionName, matched[1]);
                        } else {
                            return Promise.resolve(undefined);
                        }
                    }
                })
                .then((value: TokenResponse|undefined) => validator ? validator(context, value) : value as any);
        },
        getUserToken: function getUserToken(context) {
            // Validate adapter type
            if (!('getUserToken' in context.adapter)) { throw new Error(`OAuthPrompt.getUserToken(): not supported for the current adapter.`) }
            
            // Get the token and call validator
            const adapter = context.adapter as BotFrameworkAdapter;
            return adapter.getUserToken(context, settings.connectionName)
                          .then((value) => {
                                return Promise.resolve(validator ? validator(context, value) : value as any);
                          });
        },
        signOutUser: function signOutUser(context) {
            // Validate adapter type
            if (!('signOutUser' in context.adapter)) { throw new Error(`OAuthPrompt.signOutUser(): not supported for the current adapter.`) }

            // Sign out user
            const adapter = context.adapter as BotFrameworkAdapter;
            return adapter.signOutUser(context, settings.connectionName);
        }
    };
}

function isTokenResponseEvent(context: TurnContext): boolean {
    const a = context.activity;
    return (a.type === ActivityTypes.Event && a.name === 'tokens/response')

}
