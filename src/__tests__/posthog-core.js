import { PostHogLib } from '../posthog-core'
import { _ } from '../utils'

given('lib', () => Object.assign(new PostHogLib(), given.overrides))

describe('identify()', () => {
    given('subject', () => () => given.lib.identify(given.identity, given.userProperties))

    given('identity', () => 'a-new-id')

    given('overrides', () => ({
        get_distinct_id: () => given.oldIdentity,
        capture: jest.fn(),
        register: jest.fn(),
        register_once: jest.fn(),
        unregister: jest.fn(),
        get_property: jest.fn(),
        people: {
            set: jest.fn(),
        },
        _flags: {},
        reloadFeatureFlags: jest.fn(),
    }))

    given('properties', () => ({ $device_id: '123', __alias: 'efg' }))
    given('oldIdentity', () => 'oldIdentity')

    it('registers new user id and updates alias', () => {
        given.subject()

        expect(given.overrides.register).toHaveBeenCalledWith({ $user_id: 'a-new-id' })
        expect(given.overrides.register).toHaveBeenCalledWith({ distinct_id: 'a-new-id' })
    })

    it('calls capture when identity changes', () => {
        given.subject()

        expect(given.overrides.capture).toHaveBeenCalledWith(
            '$identify',
            {
                distinct_id: 'a-new-id',
                $anon_distinct_id: 'oldIdentity',
            },
            { $set: {} }
        )
        expect(given.overrides.people.set).not.toHaveBeenCalled()
    })

    it('calls capture with user properties if passed', () => {
        given('userProperties', () => ({ email: 'john@example.com' }))

        given.subject()

        expect(given.overrides.capture).toHaveBeenCalledWith(
            '$identify',
            {
                distinct_id: 'a-new-id',
                $anon_distinct_id: 'oldIdentity',
            },
            { $set: { email: 'john@example.com' } }
        )
    })

    describe('identity did not change', () => {
        given('oldIdentity', () => given.identity)

        it('does not capture or set user properties', () => {
            given.subject()

            expect(given.overrides.capture).not.toHaveBeenCalled()
            expect(given.overrides.people.set).not.toHaveBeenCalled()
        })

        it('calls people.set when user properties passed', () => {
            given('userProperties', () => ({ email: 'john@example.com' }))

            given.subject()

            expect(given.overrides.capture).not.toHaveBeenCalled()
            expect(given.overrides.people.set).toHaveBeenCalledWith({ email: 'john@example.com' })
        })
    })

    describe('invalid id passed', () => {
        given('identity', () => null)

        it('does not update user', () => {
            given.subject()

            expect(given.overrides.capture).not.toHaveBeenCalled()
            expect(given.overrides.register).not.toHaveBeenCalled()
        })
    })
})

describe('_calculate_event_properties()', () => {
    given('subject', () =>
        given.lib._calculate_event_properties(given.event_name, given.properties, given.start_timestamp)
    )

    given('event_name', () => 'custom_event')
    given('properties', () => ({ event: 'prop' }))

    given('overrides', () => ({
        get_config: (key) => given.config[key],
        persistence: {
            properties: () => ({ distinct_id: 'abc', persistent: 'prop' }),
        },
    }))

    given('config', () => ({
        token: 'testtoken',
        property_blacklist: given.property_blacklist,
        sanitize_properties: given.sanitize_properties,
    }))

    beforeEach(() => {
        jest.spyOn(_.info, 'properties').mockReturnValue({ $lib: 'web' })
    })

    it('returns calculated properties', () => {
        expect(given.subject).toEqual({
            token: 'testtoken',
            event: 'prop',
            $lib: 'web',
            distinct_id: 'abc',
            persistent: 'prop',
        })
    })

    it('respects property_blacklist', () => {
        given('property_blacklist', () => ['$lib', 'persistent'])

        expect(given.subject).toEqual({
            token: 'testtoken',
            event: 'prop',
            distinct_id: 'abc',
        })
    })

    it('calls sanitize_properties', () => {
        given('sanitize_properties', () => (props, event_name) => ({ token: props.token, event_name }))

        expect(given.subject).toEqual({
            event_name: given.event_name,
            token: 'testtoken',
        })
    })

    it('saves $snapshot data and token for $snapshot events', () => {
        given('event_name', () => '$snapshot')
        given('properties', () => ({ $snapshot_data: {} }))

        expect(given.subject).toEqual({
            token: 'testtoken',
            $snapshot_data: {},
            distinct_id: 'abc',
        })
    })
})