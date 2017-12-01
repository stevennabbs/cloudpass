"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.addColumn(
            'accounts',
            'passwordAuthenticationAllowed',
            {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
          );
    },

    down: function(migration) {
        return migration.dropColumn(
            'accounts',
            'passwordAuthenticationAllowed'
        );
    }
};